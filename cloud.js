/* =========================================================================
   FIT KIT — Lớp dữ liệu online (tài khoản + PT ↔ Học viên)

   Một API chung, 2 "động cơ":
   - firebase : khi firebase-config.js có apiKey → dùng Firebase Auth + Firestore
   - demo     : khi chưa cấu hình → giả lập máy chủ bằng localStorage trên máy này
                (để thử toàn bộ luồng PT ↔ học viên bằng cách đăng xuất/đăng nhập
                 2 tài khoản trên cùng 1 máy)

   Cấu trúc dữ liệu (giống nhau ở cả 2 động cơ):
   users/{uid}                 { uid, email, name, isPT, mainRole, createdAt }
   clients/{cid}               { ptId, ptName, studentUid, studentName, studentEmail,
                                 name, goal, startDate, packageTotal, phone,
                                 joinCode, remindBefore, createdAt, updatedAt }
   clients/{cid}/sessions/{id} { date, time, mode, status, title, exercises[],
                                 ptNote, feedback, completedAt, createdAt, updatedAt }
   clients/{cid}/notes/{id}    { authorUid, authorRole, authorName, text, ts }
   joinCodes/{code}            { clientId, ptId }
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
  const genCode = () => Array.from({length:6}, ()=> CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]).join("");

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
    "unavailable": "Máy chủ tạm thời không truy cập được, kiểm tra mạng.",
  };
  function niceError(e){
    const code = e && (e.code || e.message);
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
    async listClientsAsPT(uid){ return Object.values(dLoad().clients).filter(c=>c.ptId===uid); },
    async listClientsAsStudent(uid){ return Object.values(dLoad().clients).filter(c=>c.studentUid===uid); },
    async getClient(cid){ return dLoad().clients[cid] || null; },
    async createClient(data){
      const db=dLoad(); const id=rid("c"); let code; do{ code=genCode(); }while(db.joinCodes[code]);
      db.clients[id] = Object.assign({ id, joinCode: code, studentUid:null, createdAt: now(), updatedAt: now() }, data);
      db.joinCodes[code] = { clientId:id, ptId:data.ptId }; dSave(db); return db.clients[id];
    },
    async updateClient(cid, partial){ const db=dLoad(); if(!db.clients[cid]) throw dErr("not-found"); db.clients[cid]=Object.assign({}, db.clients[cid], partial, { updatedAt: now() }); dSave(db); return db.clients[cid]; },
    async deleteClient(cid){ const db=dLoad(); const c=db.clients[cid]; if(c) delete db.joinCodes[c.joinCode]; delete db.clients[cid]; delete db.sessions[cid]; delete db.notes[cid]; dSave(db); },
    async lookupCode(code){ return dLoad().joinCodes[code] || null; },
    async listSessions(cid){ return Object.values(dLoad().sessions[cid]||{}); },
    async saveSession(cid, s){ const db=dLoad(); db.sessions[cid]=db.sessions[cid]||{}; const id=s.id||rid("s"); db.sessions[cid][id]=Object.assign({}, db.sessions[cid][id]||{createdAt:now()}, s, { id, updatedAt: now() }); dSave(db); return db.sessions[cid][id]; },
    async deleteSession(cid, sid){ const db=dLoad(); if(db.sessions[cid]) delete db.sessions[cid][sid]; dSave(db); },
    async listNotes(cid){ return Object.values(dLoad().notes[cid]||{}); },
    async addNote(cid, n){ const db=dLoad(); db.notes[cid]=db.notes[cid]||{}; const id=rid("n"); db.notes[cid][id]=Object.assign({ id, ts: now() }, n); dSave(db); return db.notes[cid][id]; },
    async deleteAccount(pw){
      const db=dLoad(); const acc=db.accounts[user.email];
      if(!acc || (!acc.provider && acc.pw!==dHash(pw))) throw dErr("auth/wrong-password");
      Object.values(db.clients).forEach(c=>{
        if(c.ptId===user.uid){ delete db.joinCodes[c.joinCode]; delete db.clients[c.id]; delete db.sessions[c.id]; delete db.notes[c.id]; }
        else if(c.studentUid===user.uid){ Object.assign(c, { studentUid:null, studentName:null, studentEmail:null }); }
      });
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
  const docData = d => d.exists ? Object.assign({ id: d.id }, d.data()) : null;
  const qData = q => q.docs.map(d=>Object.assign({ id: d.id }, d.data()));

  /* ---- Đăng nhập Google / Facebook ----
     · Web / PWA: cửa sổ popup của Firebase (tự chuyển sang redirect nếu bị chặn)
     · App iOS/Android (Capacitor): plugin @capacitor-firebase/authentication đăng nhập bằng SDK gốc,
       rồi đưa token cho Firebase JS (skipNativeAuth). Xem README-store.md mục "Đăng nhập Google/Facebook". */
  function isNative(){ return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); }
  function nativeAuthPlugin(){ return isNative() && window.Capacitor.Plugins ? Capacitor.Plugins.FirebaseAuthentication : null; }
  async function socialCredentialSignIn(kind, reauthUser){
    if(isNative()){
      const P = nativeAuthPlugin();
      if(!P) throw dErr("social/not-configured");
      const res = kind==="google" ? await P.signInWithGoogle() : kind==="apple" ? await P.signInWithApple() : await P.signInWithFacebook();
      const c = res && res.credential || {};
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
    if(reauthUser) return reauthUser.reauthenticateWithPopup(provider);
    try{ return await fb.auth.signInWithPopup(provider); }
    catch(e){
      if(e && e.code==="auth/popup-blocked"){ await fb.auth.signInWithRedirect(provider); return new Promise(()=>{}); }
      throw e;
    }
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
      try{ const rr = await fb.auth.getRedirectResult(); if(rr && rr.user && !(await firebaseEngine.getUser(rr.user.uid))){ const pid=(rr.additionalUserInfo&&rr.additionalUserInfo.providerId)||"google.com"; await fb.db.collection("users").doc(rr.user.uid).set({ uid:rr.user.uid, email:rr.user.email||"", name:rr.user.displayName||"Bạn", photo:rr.user.photoURL||null, provider: pid.startsWith("facebook")?"facebook":pid.startsWith("apple")?"apple":"google", isPT:false, mainRole:null, createdAt: now() }); } }catch(e){}
      await new Promise(resolve=>{
        let first = true;
        fb.auth.onAuthStateChanged(async u=>{
          if(u){
            user = { uid:u.uid, email:u.email, name:u.displayName || (u.email||"").split("@")[0] };
            // Lúc vừa đăng ký, doc users/{uid} có thể chưa ghi xong → không ghi đè profile bằng null
            let p = null; try{ p = await firebaseEngine.getUser(u.uid); }catch(e){}
            if(p || !profile || profile.uid!==u.uid) profile = p;
          } else { user = null; profile = null; }
          if(first){ first=false; resolve(); } else emit();
        });
      });
    },
    async signUp(email, pw, name){
      const cred = await fb.auth.createUserWithEmailAndPassword(String(email).trim(), pw);
      try{ await cred.user.updateProfile({ displayName: name }); }catch(e){}
      const doc = { uid: cred.user.uid, email: cred.user.email, name: name || cred.user.email.split("@")[0], isPT:false, mainRole:null, createdAt: now() };
      await fb.db.collection("users").doc(cred.user.uid).set(doc);
      user = { uid: doc.uid, email: doc.email, name: doc.name }; profile = doc;
    },
    async signIn(email, pw){
      const cred = await fb.auth.signInWithEmailAndPassword(String(email).trim(), pw);
      user = { uid: cred.user.uid, email: cred.user.email, name: cred.user.displayName || cred.user.email.split("@")[0] };
      profile = await firebaseEngine.getUser(cred.user.uid);
      if(!profile){ profile = { uid:user.uid, email:user.email, name:user.name, isPT:false, mainRole:null, createdAt: now() }; await fb.db.collection("users").doc(user.uid).set(profile); }
    },
    async signInSocial(kind){
      const cred = await socialCredentialSignIn(kind);
      const u = cred.user;
      user = { uid: u.uid, email: u.email || "", name: u.displayName || (u.email||"").split("@")[0] || "Bạn" };
      profile = await firebaseEngine.getUser(u.uid);
      if(!profile){
        profile = { uid:user.uid, email:user.email, name:user.name, photo:u.photoURL||null, provider:kind, isPT:false, mainRole:null, createdAt: now() };
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
      const doc = Object.assign({ joinCode: code, studentUid:null, createdAt: now(), updatedAt: now() }, data);
      const batch = fb.db.batch();
      batch.set(ref, doc);
      batch.set(fb.db.collection("joinCodes").doc(code), { clientId: ref.id, ptId: data.ptId });
      await batch.commit();
      return Object.assign({ id: ref.id }, doc);
    },
    async updateClient(cid, partial){ await fb.db.collection("clients").doc(cid).update(Object.assign({}, partial, { updatedAt: now() })); return firebaseEngine.getClient(cid); },
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
      const pid = (u.providerData[0] && u.providerData[0].providerId) || "password";
      if(pid === "password") await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, pw));
      else await socialCredentialSignIn(pid.startsWith("facebook") ? "facebook" : pid.startsWith("apple") ? "apple" : "google", u);   // xác thực lại bằng Google/Facebook
      for(const c of await firebaseEngine.listClientsAsPT(u.uid)) await firebaseEngine.deleteClient(c.id);
      for(const c of await firebaseEngine.listClientsAsStudent(u.uid)){
        await fb.db.collection("clients").doc(c.id).update({ studentUid:null, studentName:null, studentEmail:null });
      }
      await fb.db.collection("users").doc(u.uid).delete();
      await u.delete();
      user=null; profile=null;
    },
  };

  /* =====================================================================
     API CÔNG KHAI
     ===================================================================== */
  let engine = mode==="firebase" ? firebaseEngine : demo;
  let ready = null;

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
    signOut: wrap(async ()=>{ await engine.signOut(); emit(); }),
    resetPassword: wrap(email=> engine.resetPassword(email)),
    deleteAccount: wrap(async pw=>{ await engine.deleteAccount(pw); emit(); }),

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
    joinByCode: wrap(async raw=>{
      if(!user) throw new Error("Chưa đăng nhập.");
      const code = String(raw||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
      if(code.length!==6) throw new Error("Mã gồm 6 ký tự, ví dụ: K7M2QX.");
      const link = await engine.lookupCode(code);
      if(!link) throw new Error("Mã không đúng hoặc đã bị xoá. Hỏi lại PT của bạn nhé.");
      if(link.ptId===user.uid) throw new Error("Đây là mã do chính bạn tạo cho học viên.");
      // Firestore rules chỉ cho học viên ghi 3 trường này khi form đang trống
      await engine.updateClient(link.clientId, { studentUid:user.uid, studentName:user.name, studentEmail:user.email });
      return engine.getClient(link.clientId);
    }),
    leaveCoach: wrap(cid=> engine.updateClient(cid, { studentUid:null, studentName:null, studentEmail:null })),

    listSessions: wrap(async cid=> (await engine.listSessions(cid)).sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time))),
    saveSession: wrap((cid, s)=> engine.saveSession(cid, s)),
    deleteSession: wrap((cid, sid)=> engine.deleteSession(cid, sid)),
    listNotes: wrap(async cid=> (await engine.listNotes(cid)).sort((a,b)=>(a.ts||0)-(b.ts||0))),
    addNote: wrap((cid, text, role, kind="note")=> engine.addNote(cid, { authorUid:user.uid, authorRole:role, authorName:user.name, text, kind })),
  };
  return api;
})();

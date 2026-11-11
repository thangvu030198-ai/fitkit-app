/* =========================================================================
   Vòng sửa lỗi sau QA (11/11/2026) — fixer SECURITY
   Hồi quy cho docs/qa/QA-security.md (QS-xx) + phần máy chủ của QA-commerce / QA-pt (QC-xx, QP-xx) mà fixer security sở hữu.
   File sở hữu: firestore.rules, storage.rules, firestore.indexes.json, firebase.json, functions/**, cloud.js, rbac.js,
   cloud-admin.js, admin.js, privacy-policy.html, delete-account.html, docs/STORE-*.md, docs/RBAC.md, capacitor.config.json,
   .github/workflows/build-*.yml, firebase-config.js.
   - Cloud Functions chạy với Admin SDK / firebase-functions GIẢ LẬP (kho Firestore trong bộ nhớ, có collectionGroup,
     bulkWriter, recursiveDelete, FieldValue.delete/increment, Storage).
   - Kịch bản rules: dùng bộ thông dịch rules mini của QA (outputs/_test/qa-security/rules-engine.js) nếu có trên máy;
     không có (repo đẩy lên GitHub) → ghi "bỏ qua" (xem docs/qa/FIX-security.md để chạy lại).
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const { assert, expectNone } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
const noComments = s=> s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

/* ---------------------------------------------------------------------
   Admin SDK + firebase-functions GIẢ LẬP — nạp functions/index.js (kéo theo admin, findpt, commerce, social, apple)
   --------------------------------------------------------------------- */
function loadIndex(){
  const store = new Map(); let auto = 0;
  const ST = { __st: true }, DEL = { __del: true };
  const INC = n=> ({ __inc: n });
  const users = new Map(); const secrets = { OWNER_BOOTSTRAP_CODE: "TEST-OWNER-CODE-123", APPLE_PRIVATE_KEY: "" };
  const files = []; const deletedAuth = [];
  const clone = v=> v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  function apply(old, d){
    const out = Object.assign({}, old || {});
    Object.keys(d || {}).forEach(k=>{ const v = d[k];
      if(v && v.__del) delete out[k];
      else if(v && v.__inc !== undefined) out[k] = (Number(out[k]) || 0) + v.__inc;
      else if(v && v.__st) out[k] = Date.now();
      else out[k] = v === undefined ? out[k] : JSON.parse(JSON.stringify(v, (kk, vv)=> (vv && vv.__st) ? Date.now() : vv)); });
    return out;
  }
  function write(p, d, merge){ store.set(p, apply(merge && store.has(p) ? store.get(p) : {}, d)); }
  function snap(p){ const d = store.get(p); return { id: p.split("/").pop(), exists: !!d, data: ()=> clone(d), ref: docRef(p) }; }
  function docRef(p){ return { id: p.split("/").pop(), path: p,
    get: async ()=> snap(p), set: async (d, o)=> write(p, d, o && o.merge), delete: async ()=>{ store.delete(p); },
    update: async d=>{ if(!store.has(p)){ const e = new Error("not-found"); e.code = 5; throw e; } write(p, d, true); },
    collection: n=> colRef(p + "/" + n) }; }
  const parentCol = k=>{ const seg = k.split("/"); return seg.slice(0, -1).join("/"); };
  function query(match, f){
    const run = ()=>{ let docs = [...store.keys()].filter(match).sort().map(snap);
      f.where.forEach(([k, op, v])=>{ docs = docs.filter(d=>{ const x = (d.data() || {})[k]; return op === "==" ? x === v : op === ">" ? x > v : true; }); });
      if(f.order){ const [k, dir] = f.order; docs.sort((a, b)=> ((a.data()[k] || 0) - (b.data()[k] || 0)) * (dir === "desc" ? -1 : 1)); }
      if(f.limit != null) docs = docs.slice(0, f.limit); return docs; };
    return { where: (k, op, v)=> query(match, Object.assign({}, f, { where: f.where.concat([[k, op, v]]) })), orderBy: (k, dir)=> query(match, Object.assign({}, f, { order: [k, dir] })),
      limit: n=> query(match, Object.assign({}, f, { limit: n })), get: async ()=>{ const docs = run(); return { docs, size: docs.length }; },
      count: ()=> ({ get: async ()=> ({ data: ()=> ({ count: run().length }) }) }) };
  }
  function colRef(p){ return Object.assign(query(k=> parentCol(k) === p, { where: [] }), { path: p, doc: id=> docRef(p + "/" + (id || ("auto" + (++auto)))),
    add: async d=>{ const r = docRef(p + "/auto" + (++auto)); write(r.path, d); return r; } }); }
  const txFn = async fn=>{ const ops = []; const tx = { get: r=> r.get(), set: (r, d, o)=> ops.push(()=> write(r.path, d, o && o.merge)),
      update: (r, d)=> ops.push(()=>{ if(!store.has(r.path)) throw new Error("not-found"); write(r.path, d, true); }), delete: r=> ops.push(()=> store.delete(r.path)),
      create: (r, d)=> ops.push(()=>{ if(store.has(r.path)) throw new Error("already exists"); write(r.path, d); }) };
    const res = await fn(tx); ops.forEach(f=> f()); return res; };
  const dbObj = { collection: colRef, getAll: async (...refs)=> Promise.all(refs.map(r=> r.get())), runTransaction: txFn,
    collectionGroup: name=> query(k=>{ const seg = k.split("/"); return seg.length >= 2 && seg[seg.length - 2] === name; }, { where: [] }),
    recursiveDelete: async ref=>{ [...store.keys()].forEach(k=>{ if(k === ref.path || k.startsWith(ref.path + "/")) store.delete(k); }); },
    bulkWriter: ()=>{ const ops = []; return { onWriteError(){}, delete: r=>{ ops.push(()=> store.delete(r.path)); return Promise.resolve(); },
      update: r=>{ const d = arguments; return Promise.resolve(); }, set: (r, d, o)=>{ ops.push(()=> write(r.path, d, o && o.merge)); return Promise.resolve(); },
      close: async ()=>{ ops.forEach(f=>{ try{ f(); }catch(e){} }); } }; } };
  // bulkWriter.update phải ghi thật (viết lại để giữ tham số)
  dbObj.bulkWriter = ()=>{ const ops = []; return { onWriteError(){},
    delete: r=>{ ops.push(()=> store.delete(r.path)); return Promise.resolve(); },
    update: (r, d)=>{ ops.push(()=>{ if(store.has(r.path)) write(r.path, d, true); }); return Promise.resolve(); },
    set: (r, d, o)=>{ ops.push(()=> write(r.path, d, o && o.merge)); return Promise.resolve(); },
    close: async ()=>{ ops.forEach(f=>{ try{ f(); }catch(e){} }); } }; };
  const firestore = ()=> dbObj;
  firestore.FieldValue = { serverTimestamp: ()=> ST, delete: ()=> DEL, increment: INC };
  firestore.Timestamp = { fromMillis: ms=> ms };
  firestore.FieldPath = { documentId: ()=> "__id__" };
  const adminMock = { initializeApp(){}, firestore,
    auth: ()=> ({
      getUser: async uid=>{ const u = users.get(uid); if(!u){ const e = new Error("no user"); e.code = "auth/user-not-found"; throw e; } return clone(u); },
      getUsers: async ids=> ({ users: ids.map(i=> users.get(i.uid)).filter(Boolean).map(clone), notFound: [] }),
      setCustomUserClaims: async (uid, c)=>{ users.get(uid).customClaims = clone(c); },
      updateUser: async (uid, p)=>{ Object.assign(users.get(uid), p); },
      deleteUser: async uid=>{ users.delete(uid); deletedAuth.push(uid); },
      revokeRefreshTokens: async uid=>{ users.get(uid).revoked = (users.get(uid).revoked || 0) + 1; } }),
    storage: ()=> ({ bucket: ()=> ({ getFiles: async o=> [files.filter(f=> f.name.startsWith(o.prefix)).map(f=> ({ name: f.name, delete: async ()=>{ f.deleted = true; } }))] }) }),
    messaging: ()=> ({ send: async ()=> "msg1" }) };
  class HttpsError extends Error { constructor(code, message, details){ super(message); this.code = code; this.details = details; } }
  const trig = (o, h)=>{ h.opts = o; return h; };
  const v1 = { region: ()=> v1, runWith: ()=> v1, auth: { user: ()=> ({ onDelete: h=> h }) } };
  const mocks = {
    "firebase-functions/v2/https": { onCall: (o, h)=>{ const f = req=> h(req); f.run = h; f.opts = o; return f; }, HttpsError },
    "firebase-functions/v2/firestore": { onDocumentCreated: trig, onDocumentWritten: trig },
    "firebase-functions/params": { defineSecret: n=> ({ value: ()=> secrets[n] }), defineString: n=> ({ value: ()=> "" }) },
    "firebase-functions/logger": { info(){}, warn(){}, error(){} },
    "firebase-functions/v1": v1,
    "firebase-admin": adminMock,
  };
  const orig = Module._load;
  Module._load = function(req){ if(mocks[req]) return mocks[req]; return orig.apply(this, arguments); };
  const dir = path.join(ROOT, "functions");
  ["index.js", "admin.js", "findpt.js", "commerce.js", "social.js", "apple.js"].forEach(f=>{ try{ delete require.cache[require.resolve(path.join(dir, f))]; }catch(e){} });
  let fx; try{ fx = require(path.join(dir, "index.js")); } finally { Module._load = orig; }
  const addUser = (uid, o)=> users.set(uid, Object.assign({ uid, email: uid + "@mail.vn", emailVerified: true, disabled: false, customClaims: {}, displayName: uid,
    providerData: [{ providerId: "password" }], metadata: { creationTime: new Date(Date.now() - 30 * 864e5).toUTCString(), lastSignInTime: new Date().toUTCString() } }, o || {}));
  const req = (uid, data, tok)=> ({ auth: uid ? { uid, token: Object.assign({ auth_time: Math.floor(Date.now() / 1000), email_verified: true, email: uid + "@mail.vn", firebase: { sign_in_provider: "password" } }, tok || {}) } : null, data });
  const call = async (name, uid, data, tok)=>{ try{ return { ok: true, res: await fx[name].run(req(uid, data, tok)) }; }catch(e){ return { ok: false, code: e.code, msg: e.message }; } };
  const keys = prefix=> [...store.keys()].filter(k=> k.startsWith(prefix));
  return { fx, store, users, secrets, files, deletedAuth, addUser, call, keys, HttpsError, set: (p, d)=> store.set(p, JSON.parse(JSON.stringify(d))), get: p=> store.get(p) };
}

/* Bộ thông dịch rules của QA (ngoài repo) */
const QA_DIR = path.resolve(ROOT, "..", "_test", "qa-security");
const FIX_DIR = path.resolve(ROOT, "..", "_test", "fix-security");
const hasEngine = fs.existsSync(path.join(QA_DIR, "rules-engine.js")) && fs.existsSync(path.join(FIX_DIR, "rules-engine-ext.js"));

module.exports = {
  name: "Vòng sửa lỗi QA — Bảo mật & tuân thủ store (fix-security)",
  area: "firestore/storage rules · Cloud Functions · cloud.js · rbac.js · cloud-admin.js · admin.js · trang xoá tài khoản · store",
  async define(t){
    const F = loadIndex();
    const C = F.fx._commerceTest, S = F.fx._socialTest, AD = F.fx._adminTest, IX = F.fx._test;

    /* ======================= 0. Functions nạp đủ ======================= */
    t.test("Functions: cú pháp hợp lệ, index.js export đủ callable/trigger của vòng sửa (commerce, social, admin, deleteMyAccount)", ()=>{
      for(const f of fs.readdirSync(path.join(ROOT, "functions")).filter(f=> f.endsWith(".js"))) new Function(read("functions/" + f).replace(/^#!.*\n/, ""));
      const need = ["revokeAppleToken", "cleanupDeletedUser", "deleteMyAccount", "bootstrapOwner", "setRole", "transferOwnership", "banUser", "unbanUser",
        "adminGetUser", "adminListUsers", "sendBroadcast", "setPaymentInfo", "logAdminAction", "verifyAudit", "ownerStatus", "chainAudit", "ptReviewAgg", "ptRespAgg",
        "createOrder", "placeOrder", "claimVoucher", "orderStockSync", "myPoints", "redeemPoints", "recordChallengeProgress", "settleChallenge", "checkInEvent",
        "checkinCodeNow", "registerEvent", "regCountAgg", "commentCountHeal", "reviewCountHeal", "routineReportHeal",
        "joinByCode", "syncPtLinks", "sessionAgg", "trialRights", "claimReviewRights", "phoneToPrivate", "migrateLegacyPhones"];
      expectNone(need.filter(n=> typeof F.fx[n] !== "function"), "thiếu export");
      // callable đều ở asia-southeast1
      expectNone(need.filter(n=> F.fx[n].opts && F.fx[n].opts.region && F.fx[n].opts.region !== "asia-southeast1"), "sai vùng");
    });

    /* ======================= 1. QS-02 · QS-14 — liên kết PT ↔ học viên ======================= */
    t.test("QS-02: cloud.js — id LUÔN là doc.id thật (dữ liệu chứa 'id' không ghi đè), form mới không nhận học viên / trường liên kết", ()=>{
      const src = noComments(read("cloud.js"));
      assert.match(src, /const docData = d => d\.exists \? Object\.assign\(\{\}, d\.data\(\), \{ id: d\.id \}\) : null;/);
      assert.match(src, /const qData = q => q\.docs\.map\(d=> Object\.assign\(\{\}, d\.data\(\), \{ id: d\.id \}\)\);/);
      assert.doesNotMatch(src, /Object\.assign\(\{ id: d\.id \}, d\.data\(\)\)/, "còn mẫu id bị dữ liệu ghi đè");
      assert.match(src, /const LINK_KEYS = \["id", "studentUid", "studentName", "studentEmail", "joinedAt", "linkedVia"\]/);
      assert.match(src, /callFn\("joinByCode"/, "Firebase: liên kết qua Cloud Function joinByCode");
      assert.match(src, /getRandomValues/, "mã mời sinh bằng bộ ngẫu nhiên mật mã");
    });
    const app = await t.app();
    const run = code=> app.ev(`(async()=>{ ${code} })()`);
    const J = async code=>{ const v = await run(code); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
    const errOf = async code=>{ try{ await run(code); return null; }catch(e){ return { message: e.message, code: e.code }; } };
    const db = ()=> JSON.parse(app.localStorage.getItem("fitkit_cloud_demo_v1") || "{}");
    const Q = JSON.stringify;
    const ctx = {};
    t.test("QS-02 (demo): PT tạo form kèm id độc + studentUid nạn nhân → id thật, studentUid null; PT không gắn được người khác; id trong partial bị bỏ", async ()=>{
      ctx.victim = await run(`await cloud.signOut(); await cloud.signUp("nan.nhan@mail.vn", "matkhau1", "Nạn nhân"); return cloud.user.uid;`);
      ctx.pt = await run(`await cloud.signOut(); await cloud.signUp("pt.xau@mail.vn", "matkhau1", "PT"); return cloud.user.uid;`);
      const c = await J(`return await cloud.createClient({ name:"Lan", id:'"><img src=x onerror=alert(1)>', studentUid:${Q(ctx.victim)}, studentName:"Nạn nhân", studentEmail:"nan.nhan@mail.vn", joinedAt: 1 })`);
      assert.ok(/^c[a-z0-9]+$/.test(c.id), "id phải là id thật: " + c.id);
      assert.equal(c.studentUid, null); assert.equal(c.studentName, undefined); assert.equal(c.joinedAt, undefined);
      ctx.cid = c.id; ctx.code = c.joinCode;
      const e = await errOf(`await cloud.updateClient(${Q(c.id)}, { studentUid:${Q(ctx.victim)} })`);
      assert.ok(e && /quyền/i.test(e.message), "PT gắn nạn nhân phải bị từ chối: " + Q(e));
      const u = await J(`return await cloud.updateClient(${Q(c.id)}, { id:"evil", goal:"Giảm mỡ" })`);
      assert.equal(u.id, c.id); assert.equal(db().clients[c.id].id, c.id);
      await run(`await cloud.signOut(); await cloud.signIn("nan.nhan@mail.vn", "matkhau1");`);
      assert.deepEqual(await J(`return await cloud.myCoaches()`), [], "nạn nhân không bị gắn vào form nào");
    });
    t.test("QS-14 (demo): học viên TỰ nhập mã (6–10 ký tự) mới vào form; người thứ hai bị từ chối; joinedAt + linkedVia do 'máy chủ' ghi", async ()=>{
      assert.equal((await errOf(`await cloud.joinByCode("ABC")`)).message, "Mã gồm 6–10 ký tự chữ và số, ví dụ: K7M2QX.");
      const c = await J(`return await cloud.joinByCode(${Q(" " + ctx.code.toLowerCase() + " ")})`);
      assert.equal(c.id, ctx.cid); assert.equal(c.studentUid, ctx.victim); assert.equal(c.linkedVia, "code"); assert.ok(c.joinedAt > 0);
      await run(`await cloud.signOut(); await cloud.signUp("ke.la@mail.vn", "matkhau1", "Người lạ");`);
      const e = await errOf(`await cloud.joinByCode(${Q(ctx.code)})`);
      assert.ok(e && /đã có học viên/.test(e.message), Q(e));
      assert.equal(db().clients[ctx.cid].studentUid, ctx.victim);
    });
    t.test("QS-14 (Function joinByCode): mã sai / form đã có người / tự nhận mã của mình bị chặn; lời mời email cần email ĐÃ XÁC MINH; giới hạn 10 lần/giờ", async ()=>{
      assert.equal(S.linkProblem(null, "u1").code, "not-found");
      assert.equal(S.linkProblem({ ptId: "u1" }, "u1").code, "failed-precondition");
      assert.equal(S.linkProblem({ ptId: "p", studentUid: "x" }, "u1").code, "already-exists");
      assert.equal(S.linkProblem({ ptId: "p", studentUid: null }, "u1"), null);
      assert.equal(S.normCode("https://tapeasy.vn/?join=k7m2-qxab"), "K7M2QXAB");
      F.addUser("ptAAAA01"); F.addUser("stuBBB01"); F.addUser("malCCC01", { emailVerified: false });
      F.set("clients/cJ1", { ptId: "ptAAAA01", studentUid: null, name: "Lan" }); F.set("joinCodes/K7M2QXAB", { clientId: "cJ1", ptId: "ptAAAA01" });
      F.set("invites/i1", { ptId: "ptAAAA01", clientId: "cJ1", email: "malccc01@mail.vn", status: "pending" });
      const inv = await F.call("joinByCode", "malCCC01", { clientId: "cJ1" }, { email_verified: false, email: "malccc01@mail.vn" });
      assert.equal(inv.ok, false); assert.equal(inv.code, "failed-precondition", "email chưa xác minh không nhận lời mời");
      assert.equal((await F.call("joinByCode", "stuBBB01", { code: "SAIMA999" })).code, "not-found");
      const ok = await F.call("joinByCode", "stuBBB01", { code: "k7m2-qxab" });
      assert.ok(ok.ok, Q(ok)); assert.equal(F.get("clients/cJ1").studentUid, "stuBBB01"); assert.equal(F.get("clients/cJ1").linkedVia, "code");
      assert.ok(F.keys("clients/cJ1/messages/").some(k=> F.get(k).kind === "system"), "dòng hệ thống do máy chủ ghi");
      assert.equal((await F.call("joinByCode", "malCCC01", { code: "K7M2QXAB" })).code, "already-exists");
      for(let i = 0; i < 10; i++) await F.call("joinByCode", "malCCC01", { code: "ZZZZZZZZ" });
      assert.equal((await F.call("joinByCode", "malCCC01", { code: "ZZZZZZZZ" })).code, "resource-exhausted", "dò mã bị giới hạn");
    });

    /* ======================= 2. Rules: 109 kịch bản của QA + kịch bản bổ sung ======================= */
    if(hasEngine){
      t.test("Rules — chạy lại NGUYÊN 109 kịch bản tấn công của QA: 22/25 lỗ hổng đã chặn (+H2 không còn tiền đề); 14/16 ca hợp lệ vẫn được phép (J1, J4 chuyển sang Cloud Functions)", ()=>{
        const before = JSON.parse(fs.readFileSync(path.join(FIX_DIR, "rules-attack-BEFORE.json"), "utf8"));
        const src = fs.readFileSync(path.join(QA_DIR, "rules-attack.test.js"), "utf8")
          .replace(`require("./rules-engine")`, `require(${Q(path.join(FIX_DIR, "rules-engine-ext.js"))})`)
          .replace(/process\.argv\[2\]/g, Q(ROOT));
        const fake = path.join(QA_DIR, "rules-attack.t65.js");
        const m = new Module(fake, module); m.filename = fake; m.paths = Module._nodeModulePaths(QA_DIR);
        const logs = []; const ol = console.log; console.log = (...a)=> logs.push(a.join(" "));
        const ow = fs.writeFileSync; let out = null;
        fs.writeFileSync = (f, d)=>{ if(/rules-attack-result\.json$/.test(String(f))) out = JSON.parse(d); else ow.apply(fs, arguments); };
        try{ m._compile(src, fake); } finally { console.log = ol; fs.writeFileSync = ow; }
        assert.ok(out && out.rows && out.rows.length === 109, "không lấy được kết quả 109 ca");
        const byId = Object.fromEntries(out.rows.map(r=> [r.id, r]));
        const vul = before.rows.filter(r=> !r.secure && r.got === r.want);
        assert.equal(vul.length, 25, "trước sửa: 25 lỗ hổng tái hiện");
        const still = vul.filter(r=> byId[r.id].got === r.got).map(r=> r.id).sort();
        assert.deepEqual(still, ["A3", "D4", "H2"], "chỉ còn A3 (dữ liệu SĐT cũ — migrateLegacyPhones), D4 (giảm thiểu ở reviewRights), H2 (tiền đề H1 đã bị chặn)");
        const ctlDeny = before.rows.filter(r=> r.secure && r.want === "allow" && byId[r.id].got !== "allow").map(r=> r.id).sort();
        assert.deepEqual(ctlDeny, ["J1", "J4"], "ca hợp lệ bị chặn ngoài dự kiến");
        t.info("Rules 109 ca QA", [`trước: 25 lỗ hổng · sau: ${still.length} còn mở theo bộ thông dịch (${still.join(", ")})`]);
      });
      t.test("Rules — 85 kịch bản bổ sung (63 vòng 1 + 22 vòng 2 R2-MR/SL/RV/VC: báo cáo Khoảnh khắc không mang trọng số, statusLog chỉ khi hoàn thành, cờ sửa đánh giá PT, giữ chỗ / cấp voucher chỉ máy chủ)", ()=>{
        delete require.cache[require.resolve(path.join(FIX_DIR, "rules-fix.test.js"))];
        const R = require(path.join(FIX_DIR, "rules-fix.test.js")).run(ROOT);
        expectNone(R.rows.filter(r=> !r.match).map(r=> `${r.id} ${r.qs} ${r.desc}: muốn ${r.want}, được ${r.got} ${r.why}`), "kịch bản sai");
        assert.ok(R.total >= 85, "thiếu kịch bản vòng 2: " + R.total);
        assert.equal(R.rows.filter(r=> /^[WY]\d/.test(r.id)).length, 22, "22 kịch bản vòng 2 (W1–W6, Y1–Y16)");
      });
    } else {
      t.test("Rules — kịch bản QA (bỏ qua: không có _test/qa-security/rules-engine.js trên máy này)", ()=>{ t.info("Bỏ qua", ["Chạy: node _test/fix-security/rerun-qa-109.js — xem docs/qa/FIX-security.md"]); });
    }
    t.test("QS-12 / QC-08 (rules tĩnh): chat client chỉ 'text'/'image' (dòng hệ thống do Function); check-in không còn ghi thẳng; đơn hàng / audit / points chỉ máy chủ ghi", ()=>{
      const r = noComments(read("firestore.rules"));
      assert.match(r, /request\.resource\.data\.kind in \['text', 'image'\]/);
      assert.doesNotMatch(r, /'log', 'system'\]/);
      assert.match(r, /match \/orders\/\{id\} \{[\s\S]*?allow create: if false;/);
      assert.match(r, /match \/admin_audit\/\{id\} \{[\s\S]*?allow create: if false;/);
      assert.match(r, /match \/points\/\{uid\} \{[\s\S]*?allow list, write: if false;/);
      assert.match(r, /function authAge\(\)/); assert.match(r, /staffFresh\(\) && authAge\(\) < 43200/);
      assert.match(r, /match \/blocks\/\{uid\}\/list\/\{other\}/);
      const st = read("storage.rules"); assert.match(st, /suspended/); assert.match(st, /auth_time/);
      const ix = JSON.parse(read("firestore.indexes.json"));
      const fo = ix.fieldOverrides.map(f=> f.collectionGroup + "." + f.fieldPath);
      expectNone(["entries.uid", "regs.uid", "requests.uid", "reviews.uid", "mcomments.uid", "mlikes.uid", "mreports.uid", "list.uid"].filter(k=> !fo.includes(k)), "thiếu index collectionGroup cho dọn dữ liệu");
    });

    /* ======================= 3. QS-08 · QS-09 · QC — máy chủ quyết giá / điểm / check-in ======================= */
    t.test("QS-08: priceOrder lấy giá từ products — bỏ qua total/price client, SL phải nguyên 1–10 (chặn qty HTML/âm/thập phân), voucher hết lượt / của người khác bị từ chối", ()=>{
      const P = { p1: { name: "Áo", price: 450000, stock: 5 }, p2: { name: "Quần", price: 300000, sizes: ["M"], stockBy: { "|M": 1 } } };
      const o = C.priceOrder([{ pid: "p1", qty: 1, price: 1 }], P, { shippingFee: 30000, freeShipFrom: 499000 }, null, "standard");
      assert.equal(o.subtotal, 450000); assert.equal(o.total, 480000);
      for(const q of ["<img src=x onerror=1>", 0, -1, 1.5, 11]) assert.throws(()=> C.priceOrder([{ pid: "p1", qty: q }], P, {}, null), /Số lượng/);
      assert.throws(()=> C.priceOrder([{ pid: "p2", size: "M", qty: 2 }], P, {}, null), /chỉ còn 1/);
      assert.equal(C.voucherProblem({ uses: 10, used: 10 }, "u", "2026-11-11"), "Mã đã hết lượt dùng.");
      assert.equal(C.voucherProblem({ uses: 1, used: 0, owner: "x" }, "u", "2026-11-11"), "Mã này thuộc tài khoản khác.");
      const n = C.normOrderInput({ payVia: "bank", shipMethod: "express", voucher: { code: "GIAM20" } });
      assert.equal(n.payment, "bank"); assert.equal(n.ship, "express"); assert.equal(n.voucherCode, "GIAM20");
    });
    t.test("QS-08 (Function placeOrder): tạo đơn giá máy chủ, trừ kho, tăng lượt voucher 1 lần/người; lỗi nghiệp vụ trả { rejected } (không rơi về ghi thẳng)", async ()=>{
      F.addUser("buyer001");
      F.set("products/p1", { name: "Áo", price: 450000, stock: 5 }); F.set("settings/public", { shippingFee: 30000, freeShipFrom: 499000 });
      F.set("vouchers/GIAM20", { code: "GIAM20", kind: "amount", value: 20000, uses: 100, used: 3 });
      const addr = { name: "Alice", phone: "0909123456", province: "Hà Nội", line: "1 Tràng Tiền" };
      const r = await F.call("placeOrder", "buyer001", { items: [{ pid: "p1", qty: 2 }], payVia: "cod", address: addr, voucher: { code: "GIAM20" }, clientTotal: 1 });
      assert.ok(r.ok && r.res.id, Q(r)); assert.equal(r.res.total, 900000 - 20000); assert.equal(r.res.pricedBy, "server");
      assert.equal(F.get("products/p1").stock, 3); assert.equal(F.get("vouchers/GIAM20").used, 4);
      const again = await F.call("placeOrder", "buyer001", { items: [{ pid: "p1", qty: 1 }], address: addr, voucher: { code: "GIAM20" } });
      assert.equal(again.res.rejected, true); assert.match(again.res.error, /đã dùng mã/);
      const bad = await F.call("placeOrder", "buyer001", { items: [{ pid: "p1", qty: "<img>" }], address: addr });
      assert.equal(bad.res.rejected, true);
    });
    t.test("QS-09 / QC-01: tiến độ thi đua có trần — bỏ ngày tương lai / ngoài kỳ, trần theo ngày, thử thách đã kết thúc từ chối; số tổng client gửi bị kẹp", ()=>{
      const ch = { metric: "run_km", start: "2026-11-01", end: "2026-11-30", target: 100 };
      const p = C.computeProgress(ch, { "2026-11-02": 10, "2026-11-03": 500, "2026-12-25": 50, "2026-10-01": 9 }, null, {}, "2026-11-05");
      assert.equal(p.value, 70, "10 + 60 (trần ngày), bỏ ngày tương lai / ngoài kỳ"); assert.equal(p.capped, true);
      assert.throws(()=> C.computeProgress(ch, { "2026-11-02": 1 }, null, {}, "2026-12-05"), /đã kết thúc/);
      const a = C.capAggregate({ metric: "sessions", start: "2026-11-01", end: "2026-11-30", target: 20 }, {}, { value: 500, weekValue: 500 }, "2026-11-03", Date.now());
      assert.equal(a.value, 6, "3 ngày × 2 buổi/ngày"); assert.ok(a.weekValue <= 6);
    });
    t.test("QC-08: check-in chỉ trong khung giờ, mã xoay vòng 60 giây / mã băm; so mã hằng thời gian", ()=>{
      const ev = { start: "2026-11-20T07:30", end: "2026-11-20T10:00" };
      assert.equal(C.checkinOpen(ev, C.isoVN("2026-11-20T05:00")), false); assert.equal(C.checkinOpen(ev, C.isoVN("2026-11-20T06:00")), true);
      assert.equal(C.checkinOpen(ev, C.isoVN("2026-11-20T17:00")), false);
      const at = Date.now(), code = C.rotatingCode("s3cret", "ev1", at);
      assert.equal(C.codeMatches({ secret: "s3cret", rotating: true }, "ev1", code, at), "rotating");
      assert.equal(C.codeMatches({ secret: "s3cret", rotating: true }, "ev1", code, at + 5 * 60000), false, "mã cũ hết hạn");
      assert.equal(C.codeMatches({ codeHash: C.sha256("ev1:XK29") }, "ev1", "xk29", at), "hash");
    });

    /* ======================= 4. QS-10 · QS-21 — xoá tài khoản ======================= */
    t.test("QS-10: deleteMyAccount xoá TOÀN BỘ dữ liệu gắn với tài khoản (routine, đánh giá, chat, đăng ký sự kiện + SĐT khẩn cấp, điểm, ticket, lời mời, Storage…), ẩn danh đơn hàng; dữ liệu người khác giữ nguyên", async ()=>{
      const U = "victim01", O = "other001";
      F.addUser(U, { email: "victim01@mail.vn" }); F.addUser(O);
      const seed = {
        "users/victim01": { name: "V" }, "users/victim01/private/contact": { phone: "0901" }, "userSocial/victim01": { liked: ["rO"], saved: [] },
        "routines/rV": { authorUid: U, title: "PPL" }, "routines/rV/likes/other001": { ts: 1 }, "routines/rO": { authorUid: O, title: "Khác", likes: 3 }, "routines/rO/likes/victim01": { ts: 1 },
        "ptListings/ptX/reviews/victim01": { uid: U, stars: 5 }, "events/e1/regs/victim01": { uid: U, phone: "0909", sos: "Mẹ 0912" }, "events/e1/regs/other001": { uid: O },
        "events/e1/reviews/victim01": { uid: U, text: "hay" }, "events/e1/reviews/other001": { uid: O, text: "ok" }, "events/e1/reviews/other001/mcomments/c1": { uid: U, text: "hi" },
        "challenges/ch1/entries/victim01": { uid: U, value: 9 }, "ptListings/ptX/requests/q1": { uid: U, msgs: [] },
        "clients/cPT": { ptId: O, studentUid: U, studentName: "V", health: { parq: {} }, measurements: [1], photos: [1], trainingSync: {} },
        "clients/cPT/messages/m1": { from: U, text: "chào" }, "clients/cPT/messages/m2": { from: O, text: "chào em" }, "clients/cPT/notes/n1": { authorUid: U, text: "x" },
        "clients/cMine": { ptId: U, studentUid: O, joinCode: "AAAAAA" }, "clients/cMine/sessions/s1": { date: "2026-11-01" }, "joinCodes/AAAAAA": { clientId: "cMine", ptId: U },
        "invites/iTo": { ptId: O, email: "victim01@mail.vn", status: "pending" }, "support_tickets/t1": { uid: U, text: "x" }, "reports/r1": { by: U, reason: "spam" },
        "orders/o1": { uid: U, total: 450000, address: { line: "1 Tràng Tiền" }, name: "V", phone: "0909", items: [{ pid: "p1" }] }, "orders/o2": { uid: O, total: 1 },
        "gifts/g1": { uid: U, status: "new" }, "gifts/g2": { uid: U, status: "shipped", address: { line: "x" } },
        "points/victim01": { balance: 100 }, "points/victim01/tx/a": { delta: 100 }, "blocks/victim01/list/other001": { uid: O }, "blocks/other001/list/victim01": { uid: U },
        "reviewRights/ptX_victim01": { uid: U, lid: "ptX" }, "vouchers/TE-PERSONAL": { owner: U }, "vouchers/GIAM20X": { code: "GIAM20X" },
      };
      Object.entries(seed).forEach(([k, v])=> F.set(k, v));
      F.files.push({ name: "media/moments/e1/victim01/a.jpg" }, { name: "media/moments/e1/other001/b.jpg" });
      const old = await F.call("deleteMyAccount", U, {}, { auth_time: Math.floor(Date.now() / 1000) - 3600 });
      assert.equal(old.code, "failed-precondition", "cần xác thực lại gần đây");
      const r = await F.call("deleteMyAccount", U, {});
      assert.ok(r.ok, Q(r));
      const gone = ["users/victim01", "users/victim01/private/contact", "userSocial/victim01", "routines/rV", "routines/rV/likes/other001", "routines/rO/likes/victim01",
        "ptListings/ptX/reviews/victim01", "events/e1/regs/victim01", "events/e1/reviews/victim01", "events/e1/reviews/other001/mcomments/c1", "challenges/ch1/entries/victim01",
        "ptListings/ptX/requests/q1", "clients/cPT/messages/m1", "clients/cPT/notes/n1", "clients/cMine", "clients/cMine/sessions/s1", "joinCodes/AAAAAA", "invites/iTo",
        "support_tickets/t1", "reports/r1", "gifts/g1", "points/victim01", "points/victim01/tx/a", "blocks/victim01/list/other001", "blocks/other001/list/victim01",
        "reviewRights/ptX_victim01", "vouchers/TE-PERSONAL"];
      expectNone(gone.filter(k=> F.store.has(k)), "còn sót dữ liệu");
      const keep = ["routines/rO", "events/e1/regs/other001", "events/e1/reviews/other001", "clients/cPT/messages/m2", "orders/o2", "vouchers/GIAM20X", "orders/o1", "gifts/g2", "clients/cPT"];
      expectNone(keep.filter(k=> !F.store.has(k)), "xoá nhầm dữ liệu cần giữ");
      const o1 = F.get("orders/o1"); assert.equal(o1.uid, null); assert.equal(o1.anonymized, true); assert.equal(o1.total, 450000);
      assert.equal(o1.address, undefined); assert.equal(o1.phone, undefined); assert.equal(o1.name, undefined);
      const cpt = F.get("clients/cPT"); assert.equal(cpt.studentUid, null); assert.equal(cpt.health, undefined); assert.equal(cpt.photos, undefined);
      assert.equal(F.get("routines/rO").likes, 2, "bộ đếm thích routine người khác giảm");
      assert.equal(F.files.find(f=> f.name.includes("/victim01/")).deleted, true); assert.ok(!F.files.find(f=> f.name.includes("/other001/")).deleted);
      assert.ok(F.deletedAuth.includes(U), "xoá tài khoản Auth");
      // kế hoạch dọn dữ liệu (nguồn cho privacy policy) phủ đủ nhóm QA liệt kê
      const plan = IX.CLEANUP_PLAN.map(p=> p.col).join(",");
      expectNone(["routines", "reviews", "regs", "entries", "requests", "support_tickets", "reports", "invites", "orders", "gifts", "messages", "storage"].filter(c=> !plan.includes(c)), "CLEANUP_PLAN thiếu");
    });
    t.test("QS-21: Chủ sở hữu KHÔNG tự xoá được (Function + app); Owner bị xoá bằng đường khác → roles_meta orphaned, bootstrapOwner khởi tạo lại được", async ()=>{
      F.addUser("owner001"); F.set("roles/owner001", { role: "owner", px: [] }); F.set("roles_meta/owner", { uid: "owner001" });
      const r = await F.call("deleteMyAccount", "owner001", {});
      assert.equal(r.code, "failed-precondition"); assert.match(r.msg, /chuyển nhượng/i);
      assert.ok(F.users.has("owner001"));
      assert.equal(IX.deletionBlocker(null, { uid: "x", orphaned: true }, "x"), null);
      await F.fx.cleanupDeletedUser({ uid: "owner001", providerData: [] });
      assert.equal(F.get("roles_meta/owner").orphaned, true);
      F.addUser("newOwner01");
      const b = await F.call("bootstrapOwner", "newOwner01", { code: F.secrets.OWNER_BOOTSTRAP_CODE });
      assert.ok(b.ok, Q(b)); assert.equal(F.get("roles_meta/owner").uid, "newOwner01"); assert.equal(F.get("roles_meta/owner").orphaned, false);
      assert.equal((await F.call("ownerStatus", "stuBBB01", {})).res.hasOwner, true);
    });
    t.test("QS-10 / 5.1.1(v): app (cloud.js) và delete-account.html gọi deleteMyAccount — trang web không tự xoá từng collection; liệt kê dữ liệu xoá / giữ ẩn danh", ()=>{
      assert.match(read("cloud.js"), /callFn\("deleteMyAccount"/);
      const h = read("delete-account.html");
      assert.match(h, /httpsCallable\("deleteMyAccount"\)/);
      assert.doesNotMatch(h, /collection\("clients"\)|u\.delete\(\)|\.ref\.delete\(\)/, "trang web vẫn tự xoá dữ liệu phía client");
      assert.match(h, /liên hệ khẩn cấp/); assert.match(h, /ẩn danh/); assert.match(h, /Chủ sở hữu/);
      assert.match(h, /accessToken/, "thu hồi token Apple từ trang web");
      const pp = read("privacy-policy.html");
      for(const kw of ["Cộng đồng", "Tìm PT", "địa chỉ giao hàng", "liên hệ khẩn cấp", "ẩn danh", "nhật ký kiểm toán", "công khai", "chặn"]) assert.ok(pp.includes(kw), "privacy-policy thiếu: " + kw);
      assert.doesNotMatch(pp, /mỗi form chỉ PT tạo ra và học viên đã nhập đúng mã mời mới truy cập được/, "còn tuyên bố bảo mật cũ");
    });

    /* ======================= 5. QS-05 · QS-13 · QS-15 · QS-18 — quản trị ======================= */
    t.test("QS-05: setPaymentInfo — chỉ settings.payment + xác thực ≤ 5 phút, audit che số + thư báo Owner; client đổi STK qua callable; rbac step-up theo auth_time thật", async ()=>{
      F.set("roles/owner002", { role: "owner", px: [] }); F.addUser("owner002"); F.set("roles_meta/owner", { uid: "owner002" });
      F.set("roles/admin002", { role: "super_admin", px: [] }); F.addUser("admin002");
      const bank = { bankName: "VCB", bankBin: "970436", accountNo: "0011223344", accountName: "TAPEASY" };
      assert.equal((await F.call("setPaymentInfo", "owner002", { bank }, { auth_time: Math.floor(Date.now() / 1000) - 3600 })).code, "failed-precondition");
      assert.equal((await F.call("setPaymentInfo", "admin002", { bank })).code, "permission-denied");
      const ok = await F.call("setPaymentInfo", "owner002", { bank });
      assert.ok(ok.ok, Q(ok)); assert.equal(F.get("settings/public").bank.accountNo, "0011223344");
      const au = F.keys("admin_audit/").map(k=> F.get(k)).filter(a=> a.action === "settings.payment");
      assert.equal(au.length, 1); assert.doesNotMatch(Q(au[0].details), /0011223344/, "audit phải che số tài khoản");
      assert.ok(F.keys("mail/").length >= 1, "thư báo Owner");
      assert.match(read("cloud-admin.js"), /callable\("setPaymentInfo"/);
      assert.match(read("rbac.js"), /if\(mode\(\) === "firebase"\) return !_claims \|\| !_claims\.authTime/);
      // Functions quản trị khác đòi phiên ≤ 12 giờ
      assert.equal((await F.call("adminGetUser", "admin002", { uid: "owner002" }, { auth_time: Math.floor(Date.now() / 1000) - 13 * 3600 })).code, "failed-precondition");
    });
    t.test("QS-13: banUser TREO vai trò nhân sự (roles.suspended + gỡ claims) → actorOf coi như không có quyền; unbanUser khôi phục", async ()=>{
      F.set("roles/mod00001", { role: "moderator", px: [] }); F.addUser("mod00001", { customClaims: { role: "moderator" } });
      const b = await F.call("banUser", "admin002", { uid: "mod00001", reason: "spam nội dung", days: 1 });
      assert.ok(b.ok, Q(b)); assert.equal(F.get("roles/mod00001").suspended, true); assert.equal(F.users.get("mod00001").customClaims.role, undefined);
      const a = await AD.actorOf({ auth: { uid: "mod00001", token: { auth_time: Math.floor(Date.now() / 1000) } } }).catch(e=> ({ err: e.code }));
      assert.equal(a.err, "permission-denied", "tài khoản bị khoá");
      F.users.get("mod00001").disabled = false;
      const u = await F.call("unbanUser", "admin002", { uid: "mod00001" });
      assert.ok(u.ok); assert.equal(F.get("roles/mod00001").suspended, false); assert.equal(F.users.get("mod00001").customClaims.role, "moderator");
    });
    t.test("QS-15: client không ghi thẳng admin_audit — logAdminAction lấy vai trò từ roles/, chỉ nhận hành động thuộc quyền; verifyAudit phát hiện cắt đuôi + sửa nội dung", async ()=>{
      F.set("roles/ana00001", { role: "analyst", px: [] }); F.addUser("ana00001");
      assert.equal((await F.call("logAdminAction", "ana00001", { action: "owner.transfer" })).code, "permission-denied");
      assert.equal((await F.call("logAdminAction", "ana00001", { action: "user.ban" })).code, "permission-denied");
      const ok = await F.call("logAdminAction", "ana00001", { action: "data.export.users", details: { rows: 3 } });
      assert.ok(ok.ok); const rec = F.get("admin_audit/" + ok.res.id); assert.equal(rec.actorRole, "analyst"); assert.equal(rec.actorUid, "ana00001");
      // chuỗi 3 bản ghi hợp lệ
      const G = AD.GENESIS; const list = []; let prev = G;
      for(let i = 1; i <= 3; i++){ const d = { seq: i, prev, actorUid: "a", actorRole: "owner", action: "x" + i, target: null, details: null, ts: i }; d.hash = AD.sha256(prev + "|" + AD.canonical(AD.auditBodyOf(d))); list.push(d); prev = d.hash; }
      assert.equal(AD.verifyChainDocs(list, { seq: 3, hash: prev }).ok, true);
      assert.equal(AD.verifyChainDocs(list.slice(0, 2), { seq: 3, hash: prev }).ok, false, "cắt đuôi phải bị phát hiện");
      const tam = JSON.parse(Q(list)); tam[1].action = "sửa"; assert.equal(AD.verifyChainDocs(tam, { seq: 3, hash: prev }).ok, false, "sửa nội dung giữ hash phải bị phát hiện");
      const ca = noComments(read("cloud-admin.js"));
      assert.doesNotMatch(ca, /collection\("admin_audit"\)\.add/); assert.match(ca, /callable\("logAdminAction"/); assert.match(ca, /callable\("verifyAudit"/);
    });
    t.test("QS-18: vai trò tên nguyên mẫu ('constructor', '__proto__', 'toString') không hợp lệ — client rbac.js và Functions", async ()=>{
      const { core } = require(path.join(ROOT, "rbac.js"));
      for(const r of ["constructor", "__proto__", "toString", "hasOwnProperty"]){
        assert.equal(core.isRole(r), false, r); assert.equal(AD.isRole(r), false, r);
        assert.deepEqual(core.permsOf(r, []), []); assert.equal(core.level(r), 0);
        assert.equal(core.checkAssign({ uid: "o", role: "owner" }, { uid: "t" }, r, []).code, "bad-role");
        assert.equal(AD.checkAssign({ uid: "o", role: "owner" }, { uid: "t" }, r, []).code, "bad-role");
      }
      F.set("roles/supRole01", { role: "super_admin", px: [] }); F.addUser("supRole01"); F.addUser("target001");
      const r = await F.call("setRole", "supRole01", { uid: "target001", role: "constructor" });
      assert.equal(r.ok, false); assert.equal(F.store.has("roles/target001"), false);
    });

    /* ======================= 6. QS-16 — chế độ demo & lối vào ẩn ======================= */
    t.test("QS-16: không còn mã Owner công khai; mã demo ngẫu nhiên riêng máy; bỏ lối vào ẩn 7 chạm; social demo không vào quản trị; native demo không có quản trị", async ()=>{
      const ca = read("cloud-admin.js"), rb = read("rbac.js"), ad = read("admin.js");
      assert.doesNotMatch(ca, /TAPEASY-OWNER-2026/); assert.doesNotMatch(noComments(rb), /_taps >= 7|openLogin\(\);\s*\}\s*\}/);
      assert.match(ca, /demoAdminBlocked/); assert.match(ad, /Thiết lập quản trị lần đầu/);
      const a2 = await t.app({ scripts: require("../lib/harness").scriptOrder() });
      const code = a2.ev("cloudAdmin.demoBootCode()");
      assert.match(code, /^TE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      assert.equal(a2.ev("cloudAdmin.demoBootCode()"), code, "ổn định trên cùng máy");
      const a3 = await t.app({ scripts: require("../lib/harness").scriptOrder() });
      assert.notEqual(a3.ev("cloudAdmin.demoBootCode()"), code, "máy khác → mã khác");
      await a2.ev(`(async()=>{ await cloud.signOut(); await cloud.signUp("o@x.vn", "matkhau1", "O"); })()`);
      let e = null; try{ await a2.ev(`cloudAdmin.bootstrapOwner("TAPEASY-OWNER-2026")`); }catch(x){ e = x; }
      assert.equal(e && e.code, "admin/bad-code");
      await a2.ev(`(async()=>{ await cloud.signOut(); await cloud.signInWithGoogle(); })()`);
      e = null; try{ await a2.ev(`TE_RBAC.reauth("")`); }catch(x){ e = x; }
      assert.ok(e && e.code === "rbac/password", "tài khoản Google giả lập không được bỏ qua xác thực");
      a2.run(`window.Capacitor = { isNativePlatform: ()=> true };`);
      assert.equal(a2.ev("cloudAdmin.demoAdminBlocked()"), true);
      assert.equal(a2.ev("cloudAdmin.demoBootCode()"), null);
      a2.run(`delete window.Capacitor;`);
    });

    /* ======================= 7. App Store 1.2 — chặn người dùng ======================= */
    t.test("App Store 1.2: cloud.blockUser / isBlocked / listBlocked / unblockUser (demo) — không tự chặn mình; rules: người bị chặn không nhắn / bình luận / gửi yêu cầu", async ()=>{
      await run(`await cloud.signOut(); await cloud.signIn("nan.nhan@mail.vn", "matkhau1");`);
      assert.equal(await run(`return await cloud.isBlocked(${Q(ctx.pt)})`), false);
      await run(`await cloud.blockUser(${Q(ctx.pt)}, { name:"PT", reason:"làm phiền" })`);
      assert.equal(await run(`return await cloud.isBlocked(${Q(ctx.pt)})`), true); assert.equal(app.ev(`cloud.isBlockedSync(${Q(ctx.pt)})`), true);
      const l = await J(`return await cloud.listBlocked()`); assert.equal(l.length, 1); assert.equal(l[0].uid, ctx.pt); assert.equal(l[0].reason, "làm phiền");
      assert.ok(await errOf(`await cloud.blockUser(cloud.user.uid)`), "không tự chặn mình");
      await run(`await cloud.unblockUser(${Q(ctx.pt)})`); assert.equal(await run(`return await cloud.isBlocked(${Q(ctx.pt)})`), false);
      const r = noComments(read("firestore.rules"));
      assert.match(r, /\(peer\(\) == null \|\| !blockedBy\(peer\(\), me\(\)\)\)/); assert.match(r, /!blockedBy\(lid, me\(\)\)/);
    });

    /* ======================= 8. Store ======================= */
    t.test("Store: Android target/compile SDK 36 + JDK 21 + chặn build phát hành chế độ demo; iOS mô tả quyền 'TapEasy'; Data safety / App Privacy khai địa chỉ, SĐT, lịch sử mua, tin nhắn; capacitor tắt debug WebView", ()=>{
      const wa = read(".github/workflows/build-android.yml");
      assert.match(wa, /targetSdkVersion = 36/); assert.match(wa, /compileSdkVersion = 36/); assert.match(wa, /java-version: 21/);
      assert.match(wa, /firebase-config\.js trống/);
      assert.doesNotMatch(read(".github/workflows/build-ios.yml"), /FIT KIT/);
      const sc = read("docs/STORE-COMPLIANCE.md");
      for(const kw of ["Physical Address", "Purchase History", "Emails or Text Messages", "Personal info → **Address**", "Financial info → **Purchase history**", "Photos and videos → **Videos**", "deleteMyAccount"]) assert.ok(sc.includes(kw), "STORE-COMPLIANCE thiếu: " + kw);
      const cap = JSON.parse(read("capacitor.config.json"));
      assert.equal(cap.android.webContentsDebuggingEnabled, false); assert.equal(cap.android.allowMixedContent, false);
      assert.match(read("docs/RBAC.md"), /demoBootCode/);
    });

    /* ======================= 9. VÒNG 2 (11/11/2026 · docs/qa/HANDOFF-ROUND-BRIEF.md mục security) ======================= */
    const ago = d=> new Date(Date.now() - d * 864e5).toUTCString();
    t.test("R2-MR (FIX-commerce §2 #4a): momentReportHeal — trọng số báo cáo Khoảnh khắc do MÁY CHỦ tính (tài khoản ≥ 3 ngày = 1, mới / tự báo cáo = 0; bỏ qua w client tự ghi), tự ẩn khi ≥ 3 trừ khi kiểm duyệt đã 'giữ'", async ()=>{
      assert.equal(C.momentReportWeight(Date.now() - 4 * 864e5, Date.now()), 1); assert.equal(C.momentReportWeight(Date.now() - 864e5, Date.now()), 0); assert.equal(C.momentReportWeight(0, Date.now()), 0);
      const p0 = C.momentReportPatch({ uid: "au" }, [{ uid: "a", sw: 1 }, { uid: "b", sw: 1 }, { uid: "au", sw: 1 }, { uid: "c", sw: 0 }], 1);
      assert.deepEqual([p0.reportCount, p0.reportWeight, p0.hidden], [3, 2, undefined], "tự báo cáo không tính; chưa đủ 3 trọng số");
      assert.equal(C.momentReportPatch({ uid: "au" }, [{ uid: "a", sw: 1 }, { uid: "b", sw: 1 }, { uid: "c", sw: 1 }], 1).hidden, true);
      assert.equal(C.momentReportPatch({ uid: "au", modOk: true }, [{ uid: "a", sw: 1 }, { uid: "b", sw: 1 }, { uid: "c", sw: 1 }], 1).hidden, undefined, "kiểm duyệt đã giữ → không tự ẩn");
      ["mrOld1", "mrOld2", "mrOld3"].forEach(u=> F.addUser(u)); F.addUser("mrNew1", { metadata: { creationTime: ago(1) } }); F.addUser("mrAuth");
      F.set("events/evM/reviews/mrAuth", { uid: "mrAuth", kind: "review", text: "x".repeat(30), reportCount: 9, reportWeight: 0 });
      const fire = async uid=>{ F.set(`events/evM/reviews/mrAuth/mreports/${uid}`, { uid, reason: "spam", ts: Date.now(), w: 1 }); return F.fx.momentReportHeal({ params: { id: "evM", rid: "mrAuth", uid } }); };
      await fire("mrNew1"); await fire("mrOld1"); await fire("mrOld2");
      let p = F.get("events/evM/reviews/mrAuth");
      assert.deepEqual([p.reportCount, p.reportWeight, !!p.hidden], [3, 2, false], "tài khoản 1 ngày tuổi (w: 1 tự ghi) không có trọng số; bộ đếm lệch được sửa");
      assert.equal(F.get("events/evM/reviews/mrAuth/mreports/mrNew1").sw, 0); assert.equal(F.get("events/evM/reviews/mrAuth/mreports/mrOld1").sw, 1);
      await fire("mrOld3"); p = F.get("events/evM/reviews/mrAuth");
      assert.deepEqual([p.reportWeight, p.hidden, p.autoHidden], [3, true, true], "≥ 3 trọng số → tự ẩn");
      assert.equal(typeof F.fx.momentReportHeal.opts, "object"); assert.equal(F.fx.momentReportHeal.opts.document, "events/{id}/reviews/{rid}/mreports/{uid}");
    });
    t.test("R2-VC (FIX-commerce §2 #4b): voucher 15 % cho người HOÀN THÀNH ngoài quà top là bản ghi máy chủ vouchers/{code} (owner, uses 1) — cấp đúng 1 lần, quà top không nhận thêm, chưa hoàn thành / số tự khai bị từ chối; myVouchers trả voucher còn dùng", async ()=>{
      const ch = { title: "Chạy 100 km", end: "2020-01-31", gifts: [{ title: "Áo" }], giftTop: 1 };
      assert.equal(C.challengeVoucherFor(ch, { uid: "a", done: true, rank: 1, value: 120 }), null, "hạng 1 nhận quà, không voucher");
      assert.equal(C.challengeVoucherFor(ch, { uid: "b", done: false, rank: 2, value: 50 }), null);
      const sp = C.challengeVoucherFor(ch, { uid: "c", done: true, rank: 2, value: 100 }); assert.equal(sp.kind, "pct"); assert.equal(sp.value, 15); assert.equal(sp.max, 100000);
      ["chU1", "chU2", "chU3", "chU4"].forEach(u=> F.addUser(u));
      F.set("challenges/chV", ch);
      F.set("challenges/chV/entries/chU1", { uid: "chU1", value: 120, done: true, serverAt: 1 }); F.set("challenges/chV/entries/chU2", { uid: "chU2", value: 100, done: true, serverAt: 1 });
      F.set("challenges/chV/entries/chU3", { uid: "chU3", value: 50, done: false, serverAt: 1 }); F.set("challenges/chV/entries/chU4", { uid: "chU4", value: 999, done: true });
      const r = await F.call("claimChallengeVoucher", "chU2", { challengeId: "chV" });
      assert.ok(r.ok && r.res.ok, Q(r)); const code = r.res.voucher.code; assert.match(code, /^TE-[A-Z2-9]{8}$/); assert.equal(r.res.voucher.server, true);
      const v = F.get("vouchers/" + code); assert.equal(v.owner, "chU2"); assert.equal(v.uses, 1); assert.equal(v.used, 0); assert.equal(v.src, "challenge");
      const again = await F.call("claimChallengeVoucher", "chU2", { challengeId: "chV" });
      assert.equal(again.res.voucher.code, code, "cấp 1 lần (voucherGrants)"); assert.equal(again.res.already, true);
      assert.equal(F.keys("vouchers/").filter(k=> F.get(k).owner === "chU2").length, 1);
      assert.match((await F.call("claimChallengeVoucher", "chU1", { challengeId: "chV" })).res.error, /quà hạng/);
      assert.equal((await F.call("claimChallengeVoucher", "chU3", { challengeId: "chV" })).res.ok, false);
      assert.equal((await F.call("claimChallengeVoucher", "chU4", { challengeId: "chV" })).res.ok, false, "số tự khai (không serverAt) không được thưởng");
      F.set("challenges/chOpen", Object.assign({}, ch, { end: "2999-12-31" }));
      assert.match((await F.call("claimChallengeVoucher", "chU2", { challengeId: "chOpen" })).res.error, /chưa kết thúc/);
      const mv = await F.call("myVouchers", "chU2", {}); assert.ok(mv.res.vouchers.some(x=> x.code === code && x.server));
      assert.equal(C.voucherProblem(v, "chU3", "2026-11-11"), "Mã này thuộc tài khoản khác.");
    });
    t.test("R2-VH (FIX-commerce §2 #4c): claimVoucher GIỮ CHỖ 30 phút — mã 1 lượt không báo 'áp dụng được' ở giỏ người khác; giữ chỗ hết hạn được dọn; createOrder tôn trọng giữ chỗ và xoá giữ chỗ khi đặt", async ()=>{
      assert.equal(C.voucherAvailable({ uses: 1, used: 0 }, [{ uid: "x", exp: Date.now() + 1e5 }], "y", Date.now()), 0);
      assert.equal(C.voucherAvailable({ uses: 1, used: 0 }, [{ uid: "x", exp: Date.now() - 1 }], "y", Date.now()), 1, "giữ chỗ hết hạn không tính");
      assert.equal(C.voucherAvailable({ uses: 1, used: 0 }, [{ uid: "y", exp: Date.now() + 1e5 }], "y", Date.now()), 1, "giữ chỗ của chính mình không tính");
      ["vhA", "vhB"].forEach(u=> F.addUser(u));
      F.set("vouchers/ONE1", { code: "ONE1", kind: "amount", value: 20000, uses: 1, used: 0 }); F.set("products/pV", { name: "Bình", price: 200000, stock: 9 });
      const a = await F.call("claimVoucher", "vhA", { code: "one1" }); assert.ok(a.res.ok, Q(a)); assert.equal(a.res.claimId, "ONE1_vhA");
      assert.ok(F.get("voucherHolds/ONE1_vhA").exp > Date.now() + 29 * 60e3);
      const b = await F.call("claimVoucher", "vhB", { code: "ONE1" }); assert.equal(b.res.ok, false); assert.match(b.res.error, /giữ chỗ/);
      assert.ok((await F.call("claimVoucher", "vhA", { code: "ONE1" })).res.ok, "người giữ chỗ áp lại được");
      const addr = { name: "Bình An", phone: "0909123456", province: "Hà Nội", line: "1 Hàng Bài" };
      const ob = await F.call("placeOrder", "vhB", { items: [{ pid: "pV", qty: 1 }], address: addr, voucher: { code: "ONE1" } });
      assert.equal(ob.res.rejected, true); assert.match(ob.res.error, /giữ chỗ/);
      const oa = await F.call("placeOrder", "vhA", { items: [{ pid: "pV", qty: 1 }], address: addr, voucher: { code: "ONE1", claimId: "ONE1_vhA" } });
      assert.ok(oa.res.id && !oa.res.rejected, Q(oa)); assert.equal(F.get("vouchers/ONE1").used, 1); assert.equal(F.store.has("voucherHolds/ONE1_vhA"), false, "đặt xong xoá giữ chỗ");
      F.set("vouchers/TWO2", { code: "TWO2", kind: "amount", value: 1000, uses: 1, used: 0 }); F.set("voucherHolds/TWO2_vhA", { code: "TWO2", uid: "vhA", at: 1, exp: Date.now() - 1000 });
      assert.ok((await F.call("claimVoucher", "vhB", { code: "TWO2" })).res.ok, "giữ chỗ hết hạn không chặn");
      assert.equal(F.store.has("voucherHolds/TWO2_vhA"), false, "giữ chỗ hết hạn được dọn");
    });
    t.test("R2-CL (FIX-pt §3 · QP-03/17): xoá tài khoản học viên dọn thêm \"BS đã cho phép\", phản hồi / nhật ký trong buổi tập, nhận xét PT, lời mời đã nhận, dấu báo cáo (routine + đánh giá PT), giữ chỗ / cấp voucher — dữ liệu của PT giữ nguyên", async ()=>{
      const U = "clStu01", O = "clPt001";
      F.addUser(U, { email: "clstu01@mail.vn" }); F.addUser(O);
      const seed = {
        "users/clStu01": { name: "S" }, "userSocial/clStu01": { reported: ["rR"] },
        "clients/cS": { ptId: O, studentUid: U, studentName: "S", parqClearance: { ok: true, by: "pt" }, goal: "Giảm mỡ" },
        "clients/cS/sessions/s1": { date: "2026-11-01", ptNote: "Khởi động kỹ", feedback: "Mệt", feedbackAt: 1, studentLog: { sets: 3 }, status: "done" },
        "clients/cS/sessions/s2": { date: "2026-11-03", ptNote: "Nghỉ", status: "scheduled" },
        "clients/cS/feedback/pt": { by: O, text: "Tiến bộ tốt", reply: "Cảm ơn thầy", shareable: true },
        "invites/iAcc": { ptId: "khac001", email: "khac@mail.vn", status: "accepted", studentUid: U, clientId: "cK" },
        "routines/rR": { authorUid: O, title: "PPL", reports: 1 }, "routines/rR/reports/clStu01": { reason: "x", ts: 1 },
        "ptListings/ptQ/reviews/rv9": { uid: "khac002", stars: 4 }, "ptListings/ptQ/reviews/rv9/reports/clStu01": { reason: "sai", at: 1, uid: U },
        "ptListings/ptQ/reviews/rv9/reports/khac003": { reason: "sai", at: 1, uid: "khac003" },
        "voucherHolds/ONE9_clStu01": { code: "ONE9", uid: U, exp: Date.now() + 1e5 }, "voucherGrants/fin_chX_clStu01": { uid: U, code: "TE-AAAABBBB" },
        "reports/rp9": { by: "khac003", type: "user", refId: U, reason: "spam", status: "open" },
      };
      Object.entries(seed).forEach(([k, v])=> F.set(k, v));
      const r = await F.call("deleteMyAccount", U, {}); assert.ok(r.ok, Q(r));
      expectNone(["clients/cS/feedback/pt", "invites/iAcc", "routines/rR/reports/clStu01", "ptListings/ptQ/reviews/rv9/reports/clStu01", "voucherHolds/ONE9_clStu01", "voucherGrants/fin_chX_clStu01"].filter(k=> F.store.has(k)), "còn sót");
      expectNone(["clients/cS", "clients/cS/sessions/s1", "clients/cS/sessions/s2", "routines/rR", "ptListings/ptQ/reviews/rv9/reports/khac003", "reports/rp9"].filter(k=> !F.store.has(k)), "xoá nhầm");
      const c = F.get("clients/cS"); assert.equal(c.parqClearance, undefined); assert.equal(c.studentUid, null); assert.equal(c.goal, "Giảm mỡ");
      const s1 = F.get("clients/cS/sessions/s1"); assert.deepEqual([s1.feedback, s1.feedbackAt, s1.studentLog, s1.ptNote], [undefined, undefined, undefined, "Khởi động kỹ"]);
      const plan = IX.CLEANUP_PLAN.map(p=> p.col).join(",");
      expectNone(["sessions", "feedback", "voucherHolds", "voucherGrants", "reports(collectionGroup)"].filter(x=> !plan.includes(x)), "CLEANUP_PLAN thiếu");
      assert.ok(JSON.parse(read("firestore.indexes.json")).fieldOverrides.some(f=> f.collectionGroup === "reports" && f.fieldPath === "uid" && f.indexes.some(i=> i.queryScope === "COLLECTION_GROUP")), "index collectionGroup reports.uid");
    });
    t.test("R2-RL (rules tĩnh — chạy cả khi không có bộ thông dịch): mreports chỉ {uid, reason, ts} + không tự báo cáo; trường máy chủ reportWeight/autoHidden; statusLog chỉ khi scheduled → done; editedAt/editedAfterReply; voucherHolds/voucherGrants chỉ Functions", ()=>{
      const r = noComments(read("firestore.rules"));
      assert.match(r, /match \/mreports\/\{uid\}\s*\{ allow create: if signedIn\(\) && me\(\) == uid && request\.resource\.data\.uid == uid\s*&& request\.resource\.data\.keys\(\)\.hasOnly\(\['uid', 'reason', 'ts'\]\)/);
      assert.match(r, /'reportWeight', 'autoHidden', 'autoModAt'\]/);
      assert.match(r, /logAppended\(o, d\) && o\.get\('status', 'scheduled'\) == 'scheduled' && d\.get\('status', ''\) == 'done'/);
      assert.match(r, /nl\[nl\.size\(\) - 1\]\.get\('to', ''\) == 'done'/);
      assert.match(r, /function editFlagsOk\(\)/); assert.match(r, /&& editFlagsOk\(\)\)/);
      assert.match(r, /match \/voucherHolds\/\{id\} \{ allow read, write: if false; \}/); assert.match(r, /match \/voucherGrants\/\{id\} \{ allow read, write: if false; \}/);
      const need = ["momentReportHeal", "claimChallengeVoucher", "myVouchers"];
      expectNone(need.filter(n=> typeof F.fx[n] !== "function"), "thiếu export vòng 2");
    });
    t.test("R2-JC (QS-14 · FIX-security Chuyển giao #1): mã mời MỚI dài 8 (cloud.js JOIN_CODE_LEN = 8) sau khi cloud-social.js nhận 6–10; mã 6 ký tự cũ vẫn dùng được", async ()=>{
      assert.match(noComments(read("cloud.js")), /const JOIN_CODE_LEN = 8;/);
      assert.match(read("cloud-social.js"), /const CODE_RE = \/\^\[A-Z0-9\]\{6,10\}\$\//, "cloud-social.js phải nhận 6–10 trước khi đổi độ dài");
      await run(`await cloud.signOut(); await cloud.signUp("pt.jc8@mail.vn", "matkhau1", "PT JC"); await cloud.updateMyProfile({ mainRole:"pt", isPT:true });`);
      const c = await J(`return await cloud.createClient({ name:"HV 8" })`);
      assert.match(c.joinCode, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
      const c6 = await J(`return await cloud.createClient({ name:"HV 6" })`);
      const d = db(); const old = "K7M2QX"; delete d.joinCodes[c6.joinCode]; d.joinCodes[old] = { clientId: c6.id, ptId: c6.ptId }; d.clients[c6.id].joinCode = old;
      app.localStorage.setItem("fitkit_cloud_demo_v1", JSON.stringify(d));
      await run(`await cloud.signOut(); await cloud.signUp("hv.jc6@mail.vn", "matkhau1", "HV JC");`);
      assert.equal((await J(`return await cloud.joinByCode("k7m2qx")`)).id, c6.id, "mã 6 ký tự đã phát vẫn nhận");
      assert.equal((await J(`return await cloud.social.previewCode(${Q(c.joinCode)})`)).code, c.joinCode, "cloud-social nhận mã 8 ký tự");
    });
    t.test("R2-WF (integrator → security): media-food.yml truyền secret PIXABAY_KEY; ios-appstore.yml 'TapEasy' + entitlement Sign in with Apple; package.json có @capacitor-firebase/authentication 6.x (= Capacitor 6); workflow gỡ plugin khi thiếu GoogleService (không crash)", ()=>{
      const mf = read(".github/workflows/media-food.yml");
      assert.match(mf, /PIXABAY_KEY: \$\{\{ secrets\.PIXABAY_KEY \}\}/); assert.doesNotMatch(mf, /[0-9]{7,9}-[0-9a-f]{25}/, "không có khoá trong workflow");
      const ia = read(".github/workflows/ios-appstore.yml");
      assert.doesNotMatch(ia, /FIT KIT/); assert.equal((ia.match(/'TapEasy /g) || []).length, 3);
      assert.match(ia, /com\.apple\.developer\.applesignin/); assert.match(ia, /CODE_SIGN_ENTITLEMENTS/);
      const pkg = JSON.parse(read("package.json")).dependencies;
      assert.match(pkg["@capacitor-firebase/authentication"], /^\^6\./); assert.match(pkg["@capacitor/core"], /^\^6\./);
      for(const f of ["ios-appstore.yml", "build-ios.yml", "build-android.yml"]){
        const w = read(".github/workflows/" + f);
        assert.match(w, /npm uninstall --no-save @capacitor-firebase\/authentication/, f + ": thiếu bước gỡ plugin khi chưa có GoogleService");
        assert.ok(w.indexOf("Firebase native") < w.indexOf("npx cap sync"), f + ": bước Firebase native phải trước cap sync");
      }
      const cap = JSON.parse(read("capacitor.config.json")).plugins.FirebaseAuthentication;
      assert.equal(cap.skipNativeAuth, true, "cloud.js đăng nhập Firebase JS bằng credential từ SDK gốc"); assert.ok(cap.providers.includes("apple.com"));
      assert.match(read("docs/STORE-COMPLIANCE.md"), /### 0\.2a Cài đăng nhập native/);
    });
  },
};

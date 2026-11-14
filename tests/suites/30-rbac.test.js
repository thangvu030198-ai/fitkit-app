/* TapEasy — Phân quyền quản trị (rbac.js · cloud-admin.js · admin.js · functions/admin.js)
   Chạy riêng: node tests/run.js --only rbac
   - Lõi thuần: ma trận, chống leo thang (vét cạn), bảo vệ Owner, SHA-256 / chuỗi băm audit
   - Đồng bộ: functions/admin.js và firestore.rules đề xuất (docs/INTEGRATION-admin.md) khớp ma trận rbac.js
   - Cloud Functions với Admin SDK giả lập: setRole, bootstrapOwner, transferOwnership, banUser, adminGetUser, chainAudit
   - App thật (động cơ demo): state.isAdmin cũ, 7 lần chạm, khởi tạo Owner, phân quyền, khoá, phiên, audit, bảng điều khiển */
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const nodeCrypto = require("crypto");
const { assert, expectNone } = require("../lib/framework");
const { scriptOrder, APP_DIR } = require("../lib/harness");

const { core } = require(path.join(APP_DIR, "rbac.js"));
const MID = ["cloud-social.js", "pt-connect.js", "community.js"];
const EVT = ["cloud-events.js", "events.js", "shop.js"];
const ADM = ["cloud-admin.js", "admin.js"];
/** Thứ tự nạp đúng INTEGRATION-admin.md: rbac.js ngay sau cloud.js; cloud-admin + admin trước health-safety.js */
function order(){
  let base = scriptOrder().filter(f=> !["rbac.js"].concat(MID, EVT, ADM).includes(f));
  const at = (name, list)=>{ let i = base.indexOf(name); if(i < 0) i = base.length - 1; base = base.slice(0, i + 1).concat(list, base.slice(i + 1)); };
  at("cloud.js", ["rbac.js"]);
  at(base.includes("pt-pro.js") ? "pt-pro.js" : "pt.js", MID);
  at(base.includes("achievements.js") ? "achievements.js" : "pt.js", EVT);
  const hs = base.indexOf("health-safety.js");
  if(hs >= 0) base = base.slice(0, hs).concat(ADM, base.slice(hs)); else base = base.concat(ADM);
  return base;
}

/* ---------------------------------------------------------------------
   Admin SDK / firebase-functions GIẢ LẬP cho functions/admin.js
   --------------------------------------------------------------------- */
function loadFunctions(){
  const store = new Map(); let auto = 0;
  const ST = { __st: true };
  const users = new Map(); const secrets = { OWNER_BOOTSTRAP_CODE: "TEST-OWNER-CODE-123" }; const sent = [];
  const clone = v=> v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const resolve = d=> JSON.parse(JSON.stringify(d, (k, v)=> (v && v.__st) ? Date.now() : v));
  function write(p, d, merge){ const r = resolve(d); store.set(p, merge && store.has(p) ? Object.assign({}, store.get(p), r) : r); }
  function snap(p){ const d = store.get(p); return { id: p.split("/").pop(), exists: !!d, data: ()=> clone(d), ref: docRef(p) }; }
  function docRef(p){ return { id: p.split("/").pop(), path: p,
    get: async ()=> snap(p), set: async (d, o)=> write(p, d, o && o.merge), delete: async ()=>{ store.delete(p); },
    update: async d=>{ if(!store.has(p)){ const e = new Error("not-found"); e.code = 5; throw e; } write(p, d, true); },
    collection: n=> colRef(p + "/" + n) }; }
  function query(p, f){
    const run = ()=>{ let docs = [...store.keys()].filter(k=> k.startsWith(p + "/") && k.slice(p.length + 1).indexOf("/") < 0).map(snap);
      f.where.forEach(([k, op, v])=>{ docs = docs.filter(d=>{ const x = (d.data() || {})[k]; return op === "==" ? x === v : op === ">" ? x > v : true; }); });
      if(f.order){ const [k, dir] = f.order; docs.sort((a, b)=> ((a.data()[k] || 0) - (b.data()[k] || 0)) * (dir === "desc" ? -1 : 1)); }
      if(f.limit != null) docs = docs.slice(0, f.limit); return docs; };
    return { where: (k, op, v)=> query(p, Object.assign({}, f, { where: f.where.concat([[k, op, v]]) })), orderBy: (k, dir)=> query(p, Object.assign({}, f, { order: [k, dir] })),
      limit: n=> query(p, Object.assign({}, f, { limit: n })), get: async ()=>{ const docs = run(); return { docs, size: docs.length }; },
      count: ()=> ({ get: async ()=> ({ data: ()=> ({ count: run().length }) }) }) };
  }
  function colRef(p){ return Object.assign(query(p, { where: [] }), { path: p, doc: id=> docRef(p + "/" + (id || ("auto" + (++auto)))),
    add: async d=>{ const r = docRef(p + "/auto" + (++auto)); write(r.path, d); return r; } }); }
  const firestore = ()=> ({ collection: colRef, getAll: async (...refs)=> Promise.all(refs.map(r=> r.get())),
    runTransaction: async fn=>{ const ops = []; const tx = { get: r=> r.get(), set: (r, d, o)=> ops.push(()=> write(r.path, d, o && o.merge)),
      update: (r, d)=> ops.push(()=>{ if(!store.has(r.path)) throw new Error("not-found"); write(r.path, d, true); }), delete: r=> ops.push(()=> store.delete(r.path)),
      create: (r, d)=> ops.push(()=>{ if(store.has(r.path)) throw new Error("already exists"); write(r.path, d); }) };
      const res = await fn(tx); ops.forEach(f=> f()); return res; } });
  firestore.FieldValue = { serverTimestamp: ()=> ST };
  firestore.Timestamp = { fromMillis: ms=> ms };
  const adminMock = { initializeApp(){}, firestore,
    auth: ()=> ({
      getUser: async uid=>{ const u = users.get(uid); if(!u){ const e = new Error("no user"); e.code = "auth/user-not-found"; throw e; } return clone(u); },
      getUsers: async ids=>{ if(ids.length > 100) throw new Error("max 100"); return { users: ids.map(i=> users.get(i.uid)).filter(Boolean).map(clone), notFound: [] }; },
      setCustomUserClaims: async (uid, c)=>{ users.get(uid).customClaims = clone(c); },
      updateUser: async (uid, p)=>{ Object.assign(users.get(uid), p); },
      revokeRefreshTokens: async uid=>{ users.get(uid).revoked = (users.get(uid).revoked || 0) + 1; } }),
    messaging: ()=> ({ send: async m=>{ sent.push(m); return "msg1"; } }) };
  class HttpsError extends Error { constructor(code, message, details){ super(message); this.code = code; this.details = details; } }
  const mocks = {
    "firebase-functions/v2/https": { onCall: (o, h)=>{ const f = req=> h(req); f.run = h; f.opts = o; return f; }, HttpsError },
    "firebase-functions/v2/firestore": { onDocumentCreated: (o, h)=>{ h.opts = o; return h; } },
    "firebase-functions/params": { defineSecret: n=> ({ value: ()=> secrets[n] }), defineString: n=> ({ value: ()=> "" }) },
    "firebase-functions/logger": { info(){}, warn(){}, error(){} },
    "firebase-admin": adminMock,
  };
  const orig = Module._load;
  Module._load = function(req){ if(mocks[req]) return mocks[req]; return orig.apply(this, arguments); };
  const file = path.join(APP_DIR, "functions", "admin.js");
  delete require.cache[require.resolve(file)];
  let fx; try{ fx = require(file); } finally { Module._load = orig; }
  const addUser = (uid, o)=> users.set(uid, Object.assign({ uid, email: uid + "@mail.vn", emailVerified: true, disabled: false, customClaims: {}, displayName: uid,
    providerData: [{ providerId: "password" }], metadata: { creationTime: new Date().toUTCString(), lastSignInTime: new Date().toUTCString() } }, o || {}));
  const req = (uid, data, tok)=> ({ auth: uid ? { uid, token: Object.assign({ auth_time: Math.floor(Date.now() / 1000), email_verified: true, firebase: { sign_in_provider: "password" } }, tok || {}) } : null, data });
  const call = async (name, uid, data, tok)=>{ try{ return { ok: true, res: await fx[name].run(req(uid, data, tok)) }; }catch(e){ return { ok: false, code: e.code, msg: e.message, details: e.details }; } };
  const audits = ()=> [...store.keys()].filter(k=> /^admin_audit\/[^/]+$/.test(k)).map(k=> Object.assign({ id: k.split("/")[1] }, store.get(k)));
  return { fx, store, users, secrets, sent, addUser, call, audits, HttpsError, ref: docRef, setRole: (uid, role)=> store.set("roles/" + uid, { role, px: [] }) };
}

module.exports = {
  name: "TapEasy Phân quyền quản trị (RBAC)",
  area: "Quản trị (rbac.js · cloud-admin.js · admin.js · functions/admin.js)",
  async define(t){
    const R = core.ROLE_ORDER;

    /* ======================= LÕI THUẦN ======================= */
    t.test("Ma trận: 10 vai trò, ≥ 30 quyền nhóm.hành_động, Owner đủ quyền, cấp bậc giảm dần, đủ quyền yêu cầu", ()=>{
      assert.deepEqual(R, ["owner","super_admin","admin","content_manager","event_manager","shop_manager","pt_manager","moderator","support","analyst"]);
      assert.ok(core.PERM_IDS.length >= 30, "số quyền: " + core.PERM_IDS.length);
      expectNone(core.PERM_IDS.filter(p=> !/^[a-z]+\.[a-z_]+$/.test(p)), "quyền sai định dạng");
      const need = ["users.view","users.ban","roles.assign","pt.verify","listings.moderate","reviews.moderate","community.moderate","kb.edit","kb.publish","events.manage","events.checkin",
        "challenges.manage","shop.products","shop.orders","shop.refund","vouchers.manage","gifts.manage","reports.view","settings.edit","audit.view","broadcast.send"];
      expectNone(need.filter(p=> !core.PERMS[p]), "thiếu quyền yêu cầu");
      assert.deepEqual(core.ROLES.owner.perms, core.PERM_IDS, "Owner phải có mọi quyền");
      R.forEach(r=>{ assert.ok(core.ROLES[r].perms.includes("panel.access"), r + " thiếu panel.access"); assert.ok(core.ROLES[r].perms.every(p=> core.PERMS[p]), r + " có quyền lạ"); });
      for(let i = 1; i < R.length; i++) assert.ok(core.level(R[i-1]) >= core.level(R[i]), "cấp bậc giảm dần " + R[i]);
      assert.ok(core.level("owner") > core.level("super_admin") && core.level("super_admin") > core.level("admin") && core.level("admin") > core.level("content_manager") && core.level("moderator") > core.level("analyst"));
      ["owner.transfer","settings.payment"].forEach(p=> assert.deepEqual(R.filter(r=> core.ROLES[r].perms.includes(p)), ["owner"], p + " chỉ của Owner"));
      assert.deepEqual(R.filter(r=> core.ROLES[r].perms.includes("roles.assign")), ["owner","super_admin"], "chỉ Owner / Super Admin gán vai trò");
      const analyst = core.ROLES.analyst.perms; assert.ok(analyst.every(p=> /\.(view|access|export)$/.test(p)), "Phân tích chỉ xem: " + analyst);
      const used = new Set(R.flatMap(r=> core.ROLES[r].perms)); expectNone(core.PERM_IDS.filter(p=> !used.has(p)), "quyền không vai trò nào có");
    });

    t.test("Không leo thang: vét cạn (người gán × người bị gán × vai trò mới × quyền lẻ) — mọi ca được phép đều thoả bất biến", ()=>{
      const roles = [null].concat(R), newRoles = [null, "owner", "bogus"].concat(R.slice(1));
      const pxs = [[], ["+roles.assign"], ["+settings.payment"], ["+owner.transfer"], ["+users.delete"], ["+audit.view"], ["+users.pii"], ["-panel.access"], ["-users.view"], ["+bogus.perm"], ["+events.manage", "-users.view"]];
      let allowed = 0, denied = 0; const bad = [];
      for(const ar of roles) for(const tr of roles) for(const nr of newRoles) for(const px of pxs) for(const self of [false, true]){
        const actor = { uid:"A", role: ar, px: [] }, target = { uid: self ? "A" : "B", role: tr, px: [] };
        const r = core.checkAssign(actor, target, nr, px);
        if(!r.ok){ denied++; assert.ok(r.msg && r.code, "lỗi phải có mã + thông báo"); continue; }
        allowed++;
        const mine = core.permsOf(ar, []);
        const why = [];
        if(!mine.includes("roles.assign")) why.push("thiếu roles.assign");
        if(self) why.push("tự đổi mình");
        if(tr === "owner") why.push("đổi Owner");
        if(!(core.level(tr) < core.level(ar))) why.push("đổi người ngang/cao hơn");
        if(nr === "owner") why.push("cấp Owner");
        if(nr && !(core.level(nr) < core.level(ar))) why.push("cấp vai trò ngang/cao hơn");
        if(nr && !core.permsOf(nr, px).every(p=> mine.includes(p))) why.push("cấp quyền mình không có");
        if(nr && px.some(x=> x[0] === "+" && core.SENSITIVE.includes(x.slice(1)))) why.push("cấp lẻ quyền nhạy cảm");
        if(why.length) bad.push(`${ar}→${tr}=${nr} ${JSON.stringify(px)}: ${why.join(", ")}`);
      }
      expectNone(bad, "ca bị leo thang");
      assert.ok(allowed > 50 && denied > allowed, `allowed=${allowed} denied=${denied}`);
      const sup = { uid:"S", role:"super_admin", px:[] };
      assert.equal(core.checkAssign(sup, { uid:"X", role:null }, "super_admin", []).code, "escalation");
      assert.equal(core.checkAssign(sup, { uid:"X", role:"super_admin" }, "admin", []).code, "peer-or-higher");
      assert.equal(core.checkAssign({ uid:"A", role:"admin", px:[] }, { uid:"X", role:null }, "analyst", []).code, "no-perm");
      assert.equal(core.checkAssign(sup, { uid:"X", role:null }, "admin", ["+settings.payment"]).code, "sensitive-extra");
      assert.equal(core.checkAssign({ uid:"O", role:"owner", px:[] }, { uid:"X", role:null }, "owner", []).code, "owner-transfer-only");
      assert.ok(core.checkAssign(sup, { uid:"X", role:null }, "moderator", ["+audit.view", "-reports.resolve"]).ok, "Super Admin cấp Moderator + quyền lẻ hợp lệ");
      assert.deepEqual(core.assignable("super_admin").includes("super_admin"), false);
      assert.deepEqual(core.assignable("admin"), []);
    });

    t.test("Owner được bảo vệ: không ai đổi vai trò / khoá được Owner; chỉ Owner chuyển nhượng", ()=>{
      const owner = { uid:"O", role:"owner" };
      R.forEach(r=>{
        const a = { uid:"A" + r, role:r, px:[] };
        assert.equal(core.checkAssign(a, owner, null, []).ok, false, r + " thu hồi Owner");
        assert.equal(core.checkAssign(a, owner, "analyst", []).ok, false, r + " hạ Owner");
        assert.equal(core.checkBan(a, owner).ok, false, r + " khoá Owner");
        assert.equal(core.checkTransfer(a, { uid:"Z" }).ok, r === "owner", r + " chuyển nhượng");
      });
      assert.equal(core.checkAssign(owner, owner, "admin", []).code, "self");
      assert.equal(core.checkBan({ uid:"S", role:"super_admin" }, { uid:"S2", role:"super_admin" }).code, "peer-or-higher");
      assert.ok(core.checkBan({ uid:"A", role:"admin" }, { uid:"M", role:"moderator" }).ok);
      assert.equal(core.checkBan({ uid:"M", role:"moderator" }, { uid:"U", role:null }).code, "no-perm");
      assert.deepEqual(core.permsOf("owner", ["-audit.view"]), core.PERM_IDS, "Owner không bị bớt quyền bằng px");
    });

    t.test("SHA-256 thuần JS khớp crypto của Node; chuỗi băm audit phát hiện sửa / xoá / chèn / đảo", ()=>{
      const samples = ["", "abc", "TapEasy — Chủ sở hữu 🏋️", "x".repeat(55), "y".repeat(56), "z".repeat(64), "w".repeat(1000), nodeCrypto.randomBytes(300).toString("base64")];
      samples.forEach(s=> assert.equal(core.sha256(s), nodeCrypto.createHash("sha256").update(s, "utf8").digest("hex"), "sha256 len " + s.length));
      const list = []; let prev = core.GENESIS;
      for(let i = 1; i <= 6; i++){ const e = { seq:i, id:"a" + i, ts: 1000 + i, actor:{ uid:"O", name:"Owner", role:"owner" }, action:"role.assign", target:{ type:"user", id:"u" + i }, details:{ n:i }, prev }; e.hash = core.auditHash(prev, e); prev = e.hash; list.push(e); }
      assert.equal(core.verifyChain(list).ok, true);
      const c1 = JSON.parse(JSON.stringify(list)); c1[2].details.n = 99; assert.equal(core.verifyChain(c1).brokenAt, 2, "sửa nội dung");
      const c2 = JSON.parse(JSON.stringify(list)); c2.splice(3, 1); assert.equal(core.verifyChain(c2).ok, false, "xoá giữa");
      const c3 = JSON.parse(JSON.stringify(list)); [c3[1], c3[2]] = [c3[2], c3[1]]; assert.equal(core.verifyChain(c3).ok, false, "đảo thứ tự");
      const c4 = JSON.parse(JSON.stringify(list)); c4[4].actor.role = "admin"; c4[4].hash = core.auditHash(c4[4].prev, c4[4]); assert.equal(core.verifyChain(c4).brokenAt, 5, "băm lại 1 bản ghi làm đứt bản sau");
      assert.equal(core.canonical({ b:1, a:[2, { d:3, c:4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}');
      assert.equal(core.mask("0011001234567"), "••••••••4567"); assert.equal(core.maskEmail("lan@mail.vn"), "l•••@mail.vn");
    });

    /* ======================= ĐỒNG BỘ ======================= */
    t.test("functions/admin.js đồng bộ ma trận + logic kiểm tra với rbac.js", ()=>{
      const F = loadFunctions().fx._adminTest;
      assert.deepEqual(F.PERM_IDS, core.PERM_IDS, "danh sách quyền");
      assert.deepEqual(F.MATRIX, core.MATRIX, "ma trận vai trò → quyền");
      assert.deepEqual(Object.fromEntries(R.map(r=> [r, F.ROLES[r].level])), Object.fromEntries(R.map(r=> [r, core.ROLES[r].level])), "cấp bậc");
      assert.deepEqual(F.SENSITIVE, core.SENSITIVE);
      const roles = [null].concat(R), diff = [];
      for(const ar of roles) for(const tr of roles) for(const nr of [null, "owner"].concat(R)) for(const px of [[], ["+audit.view"], ["+roles.assign"], ["-users.view"]]){
        const a = core.checkAssign({ uid:"A", role:ar, px:[] }, { uid:"B", role:tr }, nr, px), b = F.checkAssign({ uid:"A", role:ar, px:[] }, { uid:"B", role:tr }, nr, px);
        if(a.ok !== b.ok || a.code !== b.code) diff.push(`${ar}→${tr}=${nr} ${px}`);
        const c = core.checkBan({ uid:"A", role:ar }, { uid:"B", role:tr }), d = F.checkBan({ uid:"A", role:ar }, { uid:"B", role:tr });
        if(c.ok !== d.ok) diff.push(`ban ${ar}→${tr}`);
      }
      expectNone([...new Set(diff)], "client và Cloud Functions quyết định khác nhau");
      assert.equal(F.sha256("abc"), core.sha256("abc"));
    });

    t.test("firestore.rules đề xuất (docs/INTEGRATION-admin.md) khớp ma trận, cân ngoặc, dùng hasPerm thay isAdmin", ()=>{
      const doc = fs.readFileSync(path.join(APP_DIR, "docs", "INTEGRATION-admin.md"), "utf8");
      const m = /```\n(\/\/ TapEasy — Firestore Security Rules ĐẦY ĐỦ[\s\S]*?)\n```/.exec(doc); assert.ok(m, "không thấy khối rules");
      const rules = m[1];
      const fn = /function rolePerms\(\) \{\s*return \{([\s\S]*?)\};\s*\}/.exec(rules); assert.ok(fn, "thiếu rolePerms()");
      const map = {}; let cur = null;
      fn[1].split("\n").forEach(line=>{ const k = /'([a-z_]+)':\s*\[/.exec(line); if(k){ cur = k[1]; map[cur] = []; line = line.slice(k.index + k[0].length); }
        if(cur) (line.match(/'([a-z]+\.[a-z_]+)'/g) || []).forEach(q=> map[cur].push(q.slice(1, -1))); });
      assert.deepEqual(map, core.MATRIX, "rolePerms() trong rules ≠ ma trận rbac.js");
      let body = rules.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").replace(/'[^']*'/g, "''");
      [["{","}"],["(",")"],["[","]"]].forEach(([a,b])=> assert.equal(body.split(a).length, body.split(b).length, `ngoặc ${a}${b} không cân`));
      assert.ok(!/isAdmin\(\)/.test(body) && !/token\.admin/.test(body), "còn isAdmin() / token.admin");
      ["roles","admin_audit","settings/public","broadcasts","bans","pt_verifications","support_tickets","reports","vouchers","kb","routines","orders","gifts","events","challenges","products"].forEach(c=> assert.ok(rules.includes("match /" + c), "thiếu match /" + c));
      assert.match(rules, /match \/admin_audit\/\{id\} \{[\s\S]*?allow update, delete: if false;/, "admin_audit phải chỉ-thêm");
      assert.match(rules, /match \/roles\/\{uid\} \{[\s\S]*?allow write: if false;/, "roles chỉ Functions ghi");
      assert.match(rules, /match \/users\/\{uid\} \{\s*allow get: if signedIn\(\) && \(me\(\) == uid \|\| resource\.data\.isPT == true\);\s*allow list: if false;/, "không mở list users (BUG-03)");
      const nc = rules.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
      assert.deepEqual(nc.split("\n").filter(l=> /if true;/.test(l)).map(l=> l.trim()), ["allow read: if true;", "match /products/{id} { allow read: if true; allow write: if hasPerm('shop.products'); }"], "không thêm đọc công khai");
      const defined = new Set([...body.matchAll(/function (\w+)\(/g)].map(x=> x[1]));
      const called = new Set([...body.matchAll(/\b([a-zA-Z_]\w*)\(/g)].map(x=> x[1]).filter(n=> !["function","if","exists","existsAfter","get","getAfter","hasOnly","hasAny","hasAll","diff","affectedKeys","keys","size","lower","in","is","matches","toMillis"].includes(n)));
      expectNone([...called].filter(n=> !defined.has(n)), "hàm rules chưa định nghĩa");
    });

    /* ======================= CLOUD FUNCTIONS (Admin SDK giả lập) ======================= */
    t.test("Cloud Function bootstrapOwner: sai mã → từ chối + audit; email chưa xác minh → chặn; đúng mã → Owner; lần 2 → already-exists", async ()=>{
      const F = loadFunctions();
      F.addUser("ownerUid01"); F.addUser("otherUid02"); F.addUser("unverif03", { emailVerified:false });
      assert.equal((await F.call("bootstrapOwner", null, { code:"x" })).code, "unauthenticated");
      assert.equal((await F.call("bootstrapOwner", "unverif03", { code: F.secrets.OWNER_BOOTSTRAP_CODE }, { email_verified:false })).code, "failed-precondition");
      const w = await F.call("bootstrapOwner", "ownerUid01", { code:"SAI-MA" });
      assert.equal(w.code, "permission-denied"); assert.ok(F.audits().some(a=> a.action === "owner.bootstrap_failed"));
      const ok = await F.call("bootstrapOwner", "ownerUid01", { code:" test-owner-code-123 " });
      assert.equal(ok.ok, true, ok.msg);
      assert.equal(F.users.get("ownerUid01").customClaims.role, "owner");
      assert.equal(F.store.get("roles_meta/owner").uid, "ownerUid01");
      assert.equal(F.store.get("roles/ownerUid01").role, "owner");
      assert.equal((await F.call("bootstrapOwner", "otherUid02", { code: F.secrets.OWNER_BOOTSTRAP_CODE })).code, "already-exists");
      F.secrets.OWNER_BOOTSTRAP_CODE = "short"; assert.equal((await F.call("bootstrapOwner", "otherUid02", { code:"short" })).code, "failed-precondition", "secret quá ngắn");
    });

    t.test("Cloud Function setRole: chỉ Owner/Super Admin, không leo thang, Owner không bị hạ, claims cũ không đủ, cần đăng nhập gần đây, ghi audit + claims", async ()=>{
      const F = loadFunctions();
      ["ownerUid01","superUid02","adminUid03","userUid04","userUid05","superUid06"].forEach(u=> F.addUser(u));
      F.setRole("ownerUid01", "owner"); F.store.set("roles_meta/owner", { uid:"ownerUid01" });
      const a1 = await F.call("setRole", "ownerUid01", { uid:"superUid02", role:"super_admin", reason:"Đồng sáng lập" });
      assert.equal(a1.ok, true, a1.msg);
      assert.deepEqual(F.users.get("superUid02").customClaims, { role:"super_admin" });
      assert.ok(F.audits().some(a=> a.action === "role.assign" && a.target.id === "superUid02" && a.actorUid === "ownerUid01" && a.details.after.role === "super_admin"));
      assert.equal((await F.call("setRole", "superUid02", { uid:"adminUid03", role:"admin" })).ok, true);
      const esc = await F.call("setRole", "superUid02", { uid:"userUid04", role:"super_admin" });
      assert.equal(esc.code, "permission-denied"); assert.equal(esc.details.code, "escalation");
      assert.ok(F.audits().some(a=> a.action === "role.denied" && a.details.code === "escalation"));
      assert.equal((await F.call("setRole", "superUid02", { uid:"ownerUid01", role:"analyst" })).details.code, "owner-protected");
      assert.equal((await F.call("setRole", "superUid02", { uid:"userUid04", role:"owner" })).details.code, "owner-transfer-only");
      assert.equal((await F.call("setRole", "adminUid03", { uid:"userUid04", role:"analyst" })).code, "permission-denied", "Admin không gán vai trò");
      assert.equal((await F.call("setRole", "superUid02", { uid:"userUid04", role:"moderator", px:["+settings.payment"] })).details.code, "sensitive-extra");
      // claims giả mạo / cũ: token ghi role owner nhưng roles/{uid} không có → bị từ chối
      assert.equal((await F.call("setRole", "userUid05", { uid:"userUid04", role:"analyst" }, { role:"owner" })).code, "permission-denied", "tin claims cũ");
      // đăng nhập quá 30 phút → phải xác thực lại
      assert.equal((await F.call("setRole", "ownerUid01", { uid:"userUid04", role:"analyst" }, { auth_time: Math.floor(Date.now()/1000) - 3600 })).code, "failed-precondition");
      // thu hồi: xoá roles doc + claims
      assert.equal((await F.call("setRole", "ownerUid01", { uid:"adminUid03", role:null })).ok, true);
      assert.equal(F.store.has("roles/adminUid03"), false); assert.equal(F.users.get("adminUid03").customClaims.role, undefined);
      assert.equal((await F.call("setRole", "superUid02", { uid:"superUid02", role:"analyst" })).details.code, "self");
      assert.equal((await F.call("setRole", "ownerUid01", { uid:"bad uid!", role:"analyst" })).code, "invalid-argument");
      assert.equal((await F.call("setRole", "ownerUid01", { uid:"khongtontai99", role:"analyst" })).code, "not-found");
    });

    t.test("Cloud Function transferOwnership: chỉ Owner, xác thực ≤ 5 phút, cụm từ xác nhận; Owner cũ → Super Admin; luôn 1 Owner", async ()=>{
      const F = loadFunctions();
      ["ownerUid01","superUid02","userUid03"].forEach(u=> F.addUser(u));
      F.setRole("ownerUid01", "owner"); F.setRole("superUid02", "super_admin"); F.store.set("roles_meta/owner", { uid:"ownerUid01" });
      assert.equal((await F.call("transferOwnership", "superUid02", { uid:"userUid03", confirm:"CHUYỂN NHƯỢNG" })).code, "permission-denied");
      assert.equal((await F.call("transferOwnership", "ownerUid01", { uid:"userUid03", confirm:"ok" })).code, "invalid-argument");
      assert.equal((await F.call("transferOwnership", "ownerUid01", { uid:"userUid03", confirm:"CHUYỂN NHƯỢNG" }, { auth_time: Math.floor(Date.now()/1000) - 600 })).code, "failed-precondition");
      const ok = await F.call("transferOwnership", "ownerUid01", { uid:"superUid02", confirm:"chuyển nhượng" });
      assert.equal(ok.ok, true, ok.msg);
      assert.equal(F.store.get("roles_meta/owner").uid, "superUid02");
      assert.equal(F.store.get("roles/superUid02").role, "owner"); assert.equal(F.store.get("roles/ownerUid01").role, "super_admin");
      assert.equal(F.users.get("superUid02").customClaims.role, "owner"); assert.equal(F.users.get("ownerUid01").customClaims.role, "super_admin");
      const owners = [...F.store.keys()].filter(k=> /^roles\/[^/]+$/.test(k) && F.store.get(k).role === "owner"); assert.equal(owners.length, 1);
      assert.ok(F.audits().some(a=> a.action === "owner.transfer" && a.details.to === "superUid02"));
      assert.equal((await F.call("setRole", "ownerUid01", { uid:"superUid02", role:"analyst" })).details.code, "owner-protected", "Owner cũ không hạ được Owner mới");
    });

    t.test("Cloud Function banUser / unbanUser / adminGetUser: không khoá Owner / ngang cấp; Auth disabled + thu hồi token; email chỉ khi users.pii (ghi audit)", async ()=>{
      const F = loadFunctions();
      ["ownerUid01","adminUid02","adminUid03","userUid04","supUid05","anaUid06"].forEach(u=> F.addUser(u));
      F.setRole("ownerUid01", "owner"); F.setRole("adminUid02", "admin"); F.setRole("adminUid03", "admin"); F.setRole("supUid05", "support"); F.setRole("anaUid06", "analyst");
      assert.equal((await F.call("banUser", "adminUid02", { uid:"ownerUid01", reason:"thử khoá" })).details.code, "owner-protected");
      assert.equal((await F.call("banUser", "adminUid02", { uid:"adminUid03", reason:"thử khoá" })).details.code, "peer-or-higher");
      assert.equal((await F.call("banUser", "supUid05", { uid:"userUid04", reason:"spam nhiều lần" })).code, "permission-denied");
      assert.equal((await F.call("banUser", "adminUid02", { uid:"userUid04", reason:"x" })).code, "invalid-argument");
      const b = await F.call("banUser", "adminUid02", { uid:"userUid04", reason:"Spam quảng cáo", days:7 });
      assert.equal(b.ok, true, b.msg); assert.equal(F.users.get("userUid04").disabled, true); assert.equal(F.users.get("userUid04").revoked, 1);
      assert.ok(F.store.get("bans/userUid04").until > Date.now());
      assert.equal((await F.call("setRole", "ownerUid01", { uid:"userUid04", role:"analyst" })).details.code, "banned", "không cấp vai trò cho tài khoản bị khoá");
      assert.equal((await F.call("unbanUser", "adminUid02", { uid:"userUid04", reason:"Đã xác minh" })).ok, true);
      assert.equal(F.users.get("userUid04").disabled, false);
      const g1 = await F.call("adminGetUser", "supUid05", { uid:"userUid04" });
      assert.equal(g1.res.email, "userUid04@mail.vn"); assert.ok(F.audits().some(a=> a.action === "user.pii_view" && a.actorUid === "supUid05"));
      const g2 = await F.call("adminGetUser", "anaUid06", { uid:"userUid04" });
      assert.equal(g2.res.email, "u•••@mail.vn", "Phân tích không xem được email"); assert.equal(g2.res.role, null);
      assert.equal((await F.call("adminGetUser", "userUid04", { uid:"anaUid06" })).code, "permission-denied");
      // tài khoản bị khoá (bans còn hiệu lực) gọi hàm quản trị → bị chặn dù có vai trò
      F.store.set("bans/adminUid03", { reason:"x", until:0, liftedAt:null });
      assert.equal((await F.call("adminGetUser", "adminUid03", { uid:"userUid04" })).code, "permission-denied");
    });

    t.test("Cloud Function adminListUsers: rules vẫn cấm list users, staff xem qua hàm; email che khi thiếu users.pii; lọc PT / đội ngũ / bị khoá; đếm", async ()=>{
      const F = loadFunctions();
      ["ownerUid01","anaUid02","supUid03","ptUid04","userUid05","userUid06"].forEach((u, i)=>{ F.addUser(u); F.store.set("users/" + u, { name: u.replace(/Uid\d+/, "") + " " + i, isPT: u.startsWith("pt"), createdAt: 1000 + i }); });
      F.setRole("ownerUid01", "owner"); F.setRole("anaUid02", "analyst"); F.setRole("supUid03", "support");
      F.store.set("bans/userUid06", { reason:"spam", until:0, liftedAt:null });
      assert.equal((await F.call("adminListUsers", "userUid05", {})).code, "permission-denied", "người thường không liệt kê được");
      const a = (await F.call("adminListUsers", "anaUid02", { counts:true })).res;
      assert.equal(a.users.length, 6); assert.equal(a.total, 6); assert.equal(a.pts, 1);
      assert.ok(a.users.every(u=> !u.email || u.email.includes("•••")), "Phân tích: email bị che");
      assert.ok(a.users.filter(u=> u.role).every(u=> u.role === "?"), "Phân tích không xem vai trò cụ thể");
      assert.equal(a.users.find(u=> u.uid === "userUid06").banned, true);
      const s2 = (await F.call("adminListUsers", "supUid03", { filter:"pt" })).res;
      assert.deepEqual(s2.users.map(u=> u.uid), ["ptUid04"]); assert.equal(s2.users[0].email, "ptUid04@mail.vn", "Hỗ trợ (users.pii) thấy email");
      assert.ok(F.audits().some(x=> x.action === "user.pii_list" && x.actorUid === "supUid03"), "liệt kê có PII được ghi audit");
      const o = (await F.call("adminListUsers", "ownerUid01", { filter:"staff" })).res;
      assert.deepEqual(o.users.map(u=> u.role).sort(), ["analyst","owner","support"]);
      assert.deepEqual((await F.call("adminListUsers", "ownerUid01", { filter:"banned" })).res.users.map(u=> u.uid), ["userUid06"]);
      assert.deepEqual((await F.call("adminListUsers", "ownerUid01", { q:"ptuid04" })).res.users.map(u=> u.uid), ["ptUid04"]);
    });

    t.test("Cloud Function sendBroadcast (≤ 5/24 giờ) + chainAudit (seq/prev/hash liên tục, đánh dấu bản ghi vai trò không khớp)", async ()=>{
      const F = loadFunctions();
      F.addUser("adminUid02"); F.addUser("modUid03"); F.setRole("adminUid02", "admin"); F.setRole("modUid03", "moderator");
      assert.equal((await F.call("sendBroadcast", "modUid03", { title:"Xin chào", body:"Nội dung thông báo dài" })).code, "permission-denied");
      assert.equal((await F.call("sendBroadcast", "adminUid02", { title:"Hi", body:"ngắn" })).code, "invalid-argument");
      for(let i = 0; i < 5; i++) assert.equal((await F.call("sendBroadcast", "adminUid02", { title:"Giải chạy " + i, body:"Mở đăng ký giải chạy tháng 12", push: i === 0 })).ok, true);
      assert.equal((await F.call("sendBroadcast", "adminUid02", { title:"Lần thứ 6", body:"Vượt giới hạn trong ngày" })).code, "resource-exhausted");
      assert.equal(F.sent.length, 1); assert.equal(F.sent[0].topic, "all");
      F.store.set("admin_audit/client1", { actorUid:"modUid03", actorRole:"admin", action:"mod.routine.hide", client:"web", ts: Date.now() });   // vai trò khai sai
      const ids = F.audits().map(a=> a.id);
      for(const id of ids) await F.fx._adminTest.chainOne(F.ref("admin_audit/" + id));
      const list = F.audits().sort((a,b)=> a.seq - b.seq);
      assert.deepEqual(list.map(a=> a.seq), list.map((_, i)=> i + 1), "seq liên tục");
      let prev = "GENESIS"; list.forEach(a=>{ assert.equal(a.prev, prev); assert.match(a.hash, /^[0-9a-f]{64}$/); prev = a.hash; });
      assert.equal(F.store.get("admin_audit_meta/head").seq, list.length);
      assert.equal(list.find(a=> a.id === "client1").suspicious, true, "bản ghi client khai sai vai trò bị đánh dấu");
      const again = await F.fx._adminTest.chainOne(F.ref("admin_audit/" + ids[0]));
      assert.equal(again, 1, "chạy lại trigger không xích 2 lần");
    });

    /* ======================= APP (động cơ demo) ======================= */
    const app = await t.app({ scripts: order(), settleMs: 200, storage: { "fitkit_state_v1": JSON.stringify(Object.assign(require("../lib/harness").seededState(), { isAdmin: true })) } });
    const run = code=> app.ev(`(async()=>{ ${code} })()`);
    const J = async code=>{ const v = await run(code); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
    const errOf = async code=>{ try{ await run(code); return null; }catch(e){ return { message: e.message, code: e.code }; } };
    const S = JSON.stringify;
    const signUp = (email, name, pw)=> run(`await cloud.signOut(); await cloud.signUp(${S(email)}, ${S(pw || "matkhau1")}, ${S(name)}); return cloud.user.uid;`);
    const as = async (email, pw)=>{ await run(`await cloud.signOut(); await cloud.signIn(${S(email)}, ${S(pw || "matkhau1")}); await TE_RBAC.login(${S(pw || "matkhau1")});`); };
    const U = {};

    t.test("Nạp module không lỗi; TE_RBAC / teCan / cloudAdmin / TE_ADMIN sẵn sàng; teCan gọi TE_RBAC", ()=>{
      assert.deepEqual(app.loadErrors.map(e=> e.file + ": " + e.error.message), []);
      const o = app.order; assert.equal(o[o.indexOf("cloud.js") + 1], "rbac.js", "rbac.js ngay sau cloud.js");
      assert.ok(o.indexOf("admin.js") > o.indexOf("shop.js"));
      assert.equal(app.ev("typeof TE_RBAC.can"), "function"); assert.equal(app.ev("typeof cloudAdmin.setRole"), "function"); assert.equal(app.ev("typeof TE_ADMIN.open"), "function");
      assert.equal(app.ev("cloudAdmin.mode"), "demo");
      app.run(`globalThis.__calls = 0; const _c = TE_RBAC.can; TE_RBAC.__origCan = _c;`);
      assert.equal(app.ev("teCan('users.view')"), false, "chưa đăng nhập quản trị → false");
      assert.equal(app.ev("teCan === window.teCan && typeof teCan.any"), "function");
      assert.equal(app.ev("cloudEvents.__rbac"), true, "cloudEvents đã được bọc quyền");
      expectNone(app.consoleLog.filter(l=> l[0] === "error" && /rbac|admin/i.test(l[1])).map(l=> l[1]), "console.error");
    });

    t.test("state.isAdmin cũ bị vô hiệu: cờ lưu sẵn bị xoá khi nạp, gán true không cấp quyền, không lưu vào localStorage", ()=>{
      assert.equal(app.ev("state.isAdmin"), false, "isAdmin:true từ dữ liệu cũ không còn tác dụng");
      assert.equal(app.ev("TapEv.isAdmin()"), false);
      app.run("state.isAdmin = true;");
      assert.equal(app.ev("state.isAdmin"), false, "gán tay không cấp quyền");
      app.run("saveState();");
      assert.ok(!/"isAdmin":true/.test(app.localStorage.getItem("fitkit_state_v1")), "không lưu isAdmin:true");
      assert.equal(app.ev("Object.keys(state).includes('isAdmin')"), false, "không liệt kê (không lưu)");
    });

    // fix-security QS-16 (App Store 2.3.1): lối vào ẨN "chạm 7 lần" đã bỏ — chạm dòng phiên bản KHÔNG mở gì (trước: mở đăng nhập quản trị);
    //   lối vào hiển thị = Hồ sơ → "Bảng quản trị" / "Thiết lập quản trị lần đầu". Bộ đếm cũ của events.js vẫn bị chặn.
    t.test("Chạm 7 lần dòng phiên bản: KHÔNG bật quyền, KHÔNG mở bảng quản trị (QS-16 — bỏ lối vào ẩn), bộ đếm cũ của events.js bị chặn", async ()=>{
      const n = app.ev(`(function(){
        const ls = document._listeners.click || []; let opened = 0; const o = TE_ADMIN.open; TE_ADMIN.open = function(){ opened++; };
        for(let i = 0; i < 7; i++){
          const ev = { target:{ closest: sel=> /screen-profile/.test(sel) ? { textContent:"TapEasy v2.0.0" } : null }, _stop:false, stopImmediatePropagation(){ this._stop = true; }, preventDefault(){}, stopPropagation(){} };
          for(const fn of ls){ fn(ev); if(ev._stop) break; }
        }
        TE_ADMIN.open = o; return opened; })()`);
      assert.equal(n, 0, "7 chạm không còn mở màn quản trị (lối vào ẩn — QS-16)");
      assert.equal(app.ev("state.isAdmin"), false);
    });

    t.test("Khởi tạo Owner: sai mã bị từ chối (ghi audit); đúng mã (docs) → Owner; lần 2 bị chặn; can() cần đăng nhập quản trị bằng mật khẩu", async ()=>{
      U.owner = await signUp("chu.app@tapeasy.vn", "Chủ App");
      assert.equal(await J("return await cloudAdmin.hasOwner()"), false);
      assert.equal((await errOf(`await cloudAdmin.bootstrapOwner("SAI-MA-123")`)).code, "admin/bad-code");
      // fix-security QS-16: không còn mã công khai "TAPEASY-OWNER-2026" — bản demo dùng mã ngẫu nhiên riêng từng máy
      assert.equal((await errOf(`await cloudAdmin.bootstrapOwner("TAPEASY-OWNER-2026")`)).code, "admin/bad-code", "mã mặc định công khai cũ phải bị từ chối");
      const boot = app.ev("cloudAdmin.demoBootCode()"); assert.match(boot, /^TE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      await run(`await cloudAdmin.bootstrapOwner(${S(boot.toLowerCase())})`);
      assert.equal(app.ev("TE_RBAC.role()"), "owner");
      assert.equal(app.ev("TE_RBAC.can('roles.assign')"), false, "có vai trò nhưng chưa vào phiên quản trị");
      assert.equal((await errOf(`await TE_RBAC.login("sai-mat-khau")`)).code, "rbac/password");
      await run(`await TE_RBAC.login("matkhau1")`);
      assert.equal(app.ev("TE_RBAC.active() && teCan('owner.transfer') && state.isAdmin"), true);
      U.u2 = await signUp("ke.gian@mail.vn", "Kẻ gian");
      assert.equal((await errOf(`await cloudAdmin.bootstrapOwner("TAPEASY-OWNER-2026")`)).code, "admin/owner-exists");
      assert.equal(app.ev("TE_RBAC.role()"), null);
      assert.equal((await errOf(`await TE_RBAC.login("matkhau1")`)).code, "rbac/no-role");
    });

    t.test("Phân tầng demo: Owner → Super Admin → Admin/QL; Super Admin không cấp Super Admin, không hạ/khoá Owner; Admin không gán vai trò; cần xác thực lại sau 5 phút", async ()=>{
      U.sup = await signUp("sa@tapeasy.vn", "Quản trị cấp cao");
      U.adm = await signUp("ad@tapeasy.vn", "Quản trị viên");
      U.shop = await signUp("shop@tapeasy.vn", "Quản lý shop");
      U.ev = await signUp("ev@tapeasy.vn", "Quản lý sự kiện");
      U.mod = await signUp("mod@tapeasy.vn", "Kiểm duyệt");
      U.ana = await signUp("ana@tapeasy.vn", "Phân tích");
      U.sp = await signUp("cskh@tapeasy.vn", "Hỗ trợ");
      U.user = await signUp("lan@mail.vn", "Lan <img src=x onerror=alert(1)>");
      await as("chu.app@tapeasy.vn");
      await run(`await cloudAdmin.setRole(${S(U.sup)}, "super_admin", { reason:"Đồng sáng lập" })`);
      await as("sa@tapeasy.vn");
      for(const [k, r] of [["adm","admin"],["shop","shop_manager"],["ev","event_manager"],["mod","moderator"],["ana","analyst"],["sp","support"]]) await run(`await cloudAdmin.setRole(${S(U[k])}, ${S(r)}, { reason:"Phân công" })`);
      assert.equal((await errOf(`await cloudAdmin.setRole(${S(U.user)}, "super_admin")`)).code, "admin/escalation");
      assert.equal((await errOf(`await cloudAdmin.setRole(${S(U.owner)}, "analyst")`)).code, "admin/owner-protected");
      assert.equal((await errOf(`await cloudAdmin.setRole(${S(U.owner)}, null)`)).code, "admin/owner-protected");
      assert.equal((await errOf(`await cloudAdmin.ban(${S(U.owner)}, { reason:"thử khoá chủ" })`)).code, "admin/owner-protected");
      assert.equal((await errOf(`await cloudAdmin.setRole(${S(U.sup)}, "admin")`)).code, "admin/self");
      assert.equal((await errOf(`await cloudAdmin.transferOwnership(${S(U.sup)}, { confirm:"CHUYỂN NHƯỢNG" })`)).code, "permission-denied");
      // xác thực lại sau 5 phút cho thao tác nhạy cảm
      const t0 = app.ev("Date.now()"); app.setNow(t0 + 6 * 60000);
      assert.equal((await errOf(`await cloudAdmin.setRole(${S(U.user)}, "analyst")`)).code, "rbac/step-up");
      await run(`await TE_RBAC.stepUp("matkhau1")`);
      await run(`await cloudAdmin.setRole(${S(U.user)}, "analyst", { reason:"thử" }); await cloudAdmin.setRole(${S(U.user)}, null, { reason:"thu hồi" });`);
      app.setNow(null);
      await as("ad@tapeasy.vn");
      assert.equal((await errOf(`await cloudAdmin.setRole(${S(U.user)}, "analyst")`)).code, "permission-denied", "Admin không có roles.assign");
      assert.equal(app.ev("TE_RBAC.can('roles.view') && !TE_RBAC.can('roles.assign') && !TE_RBAC.can('settings.payment')"), true);
      const staff = await J("return await cloudAdmin.listStaff()");
      assert.deepEqual(staff.map(s=> s.role).slice().sort(), ["admin","analyst","event_manager","moderator","owner","shop_manager","super_admin","support"]);
      assert.ok(staff.every((s, i)=> !i || app.ev(`TE_RBAC.levelOf(${S(staff[i-1].role)}) >= TE_RBAC.levelOf(${S(s.role)})`)), "xếp theo cấp bậc");
      assert.equal(staff.filter(s=> s.role === "owner").length, 1);
    });

    t.test("Quyền lẻ (px): bớt quyền có hiệu lực; không cấp lẻ quyền nhạy cảm / quyền mình không có", async ()=>{
      await as("chu.app@tapeasy.vn");
      await run(`await cloudAdmin.setRole(${S(U.mod)}, "moderator", { px:["-community.moderate", "+audit.view"], reason:"Chỉ duyệt đánh giá + xem nhật ký" })`);
      assert.equal((await errOf(`await cloudAdmin.setRole(${S(U.mod)}, "moderator", { px:["+roles.assign"] })`)).code, "admin/sensitive-extra");
      await as("sa@tapeasy.vn");
      assert.equal((await errOf(`await cloudAdmin.setRole(${S(U.ana)}, "analyst", { px:["+settings.payment"] })`)).code, "admin/sensitive-extra");
      await as("mod@tapeasy.vn");
      assert.deepEqual(app.evj("['community.moderate','reviews.moderate','audit.view','roles.view'].map(p=> TE_RBAC.can(p))"), [false, true, true, false]);
      await as("sa@tapeasy.vn");
      await run(`await cloudAdmin.setRole(${S(U.mod)}, "moderator", { px:[], reason:"Trả lại mặc định" })`);
    });

    t.test("Khoá tài khoản: người bị khoá không đăng nhập được; Admin không khoá Admin khác / Super Admin; mở khoá → đăng nhập lại được", async ()=>{
      await as("ad@tapeasy.vn");
      assert.equal((await errOf(`await cloudAdmin.ban(${S(U.sup)}, { reason:"thử khoá cấp trên" })`)).code, "admin/peer-or-higher");
      assert.equal((await errOf(`await cloudAdmin.ban(${S(U.user)}, { reason:"x" })`)).code, "admin/reason");
      await run(`await cloudAdmin.ban(${S(U.user)}, { reason:"Spam quảng cáo nhiều lần", days:7 })`);
      const e = await errOf(`await cloud.signOut(); await cloud.signIn("lan@mail.vn", "matkhau1")`);
      assert.equal(e && e.code, "auth/user-disabled"); assert.equal(app.ev("cloud.user"), null, "bị đăng xuất ngay");
      await as("ad@tapeasy.vn");
      const banned = await J(`return (await cloudAdmin.listUsers({ filter:"banned" })).map(u=> u.uid)`);
      assert.deepEqual(banned, [U.user]);
      await run(`await cloudAdmin.unban(${S(U.user)}, { reason:"Đã cam kết" })`);
      await run(`await cloud.signOut(); await cloud.signIn("lan@mail.vn", "matkhau1")`);
      assert.equal(app.ev("cloud.user && cloud.user.uid"), U.user);
    });

    t.test("Phiên quản trị: tự khoá sau 30 phút rảnh; khoá 5 phút sau 5 lần sai mật khẩu; đăng xuất tài khoản → hết phiên", async ()=>{
      await as("ad@tapeasy.vn");
      assert.equal(app.ev("TE_RBAC.active()"), true);
      const t0 = app.ev("Date.now()"); app.setNow(t0 + 31 * 60000);
      assert.equal(app.ev("TE_RBAC.active() || TE_RBAC.can('users.view')"), false, "hết phiên sau 30 phút");
      app.setNow(null);
      for(let i = 0; i < 5; i++) await errOf(`await TE_RBAC.login("sai-${i}")`);
      const locked = await errOf(`await TE_RBAC.login("matkhau1")`);
      assert.equal(locked.code, "rbac/locked", "khoá sau 5 lần sai");
      app.setNow(Date.now() + 6 * 60000);
      await run(`await TE_RBAC.login("matkhau1")`); assert.equal(app.ev("TE_RBAC.active()"), true);
      app.setNow(null);
      await run(`await cloud.signOut()`); assert.equal(app.ev("TE_RBAC.active()"), false);
      const fails = await (async ()=>{ await as("chu.app@tapeasy.vn"); return J(`return (await cloudAdmin.listAudit({ q:"login_failed" })).length`); })();
      assert.ok(fails >= 5, "ghi audit đăng nhập sai: " + fails);
    });

    t.test("Tương thích state.isAdmin + bọc cloudEvents: QL sự kiện / QL cửa hàng / Phân tích đúng phạm vi; huỷ đơn đã xác nhận cần shop.refund", async ()=>{
      await as("ev@tapeasy.vn");
      assert.equal(app.ev("state.isAdmin && TapEv.isAdmin()"), true, "QL sự kiện thấy công cụ sự kiện");
      // vòng tích hợp 3: thử thách bắt buộc ảnh/clip + mô tả ≥ 80 ký tự (events-media.js — INTEGRATION-events-shop §10.1)
      const ch = await J(`return await cloudEvents.saveChallenge({ title:"Tháng 12: 20 buổi", metric:"sessions", target:20, unit:"buổi", start:"2026-12-01", end:"2026-12-31", month:"2026-12",
        desc:"Hoàn thành 20 buổi tập trong tháng 12 để nhận huy hiệu và quà. Mỗi buổi tính khi bạn bấm Hoàn thành trong tab Tập luyện.",
        media:[{ id:"m1", kind:"image", src:"https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg" }] })`);
      assert.ok(ch && ch.id);
      assert.equal((await errOf(`await cloudEvents.saveProduct({ name:"Áo mới", price:99000 })`)).code, "permission-denied");
      await as("shop@tapeasy.vn");
      assert.equal((await errOf(`await cloudEvents.saveChallenge({ title:"Thử hack", target:1 })`)).code, "permission-denied", "QL cửa hàng không sửa thử thách");
      await run(`await cloud.signOut(); await cloud.signIn("lan@mail.vn", "matkhau1")`);
      const o = await J(`return await cloudEvents.placeOrder({ items:[{ pid:"p_tee", name:"Áo", qty:1, price:249000 }], subtotal:249000, shipping:30000, discount:0, total:279000, payment:"cod", address:{ name:"Lan", phone:"0912345678", province:"Hà Nội", street:"1 Tràng Tiền" } })`);
      assert.equal((await errOf(`await cloudEvents.updateOrder(${S(o.id)}, { status:"confirmed" })`)).code, "permission-denied", "khách không tự xác nhận đơn");
      await as("shop@tapeasy.vn");
      await run(`await cloudEvents.updateOrder(${S(o.id)}, { status:"confirmed" })`);
      app.run(`TE_RBAC.__sav = cloudAdmin._demo.load(); `);
      await as("chu.app@tapeasy.vn");
      await run(`await cloudAdmin.setRole(${S(U.shop)}, "shop_manager", { px:["-shop.refund"], reason:"Chưa được hoàn tiền" })`);
      await as("shop@tapeasy.vn");
      assert.equal((await errOf(`await cloudEvents.updateOrder(${S(o.id)}, { status:"cancelled" })`)).code, "permission-denied", "huỷ đơn đã xác nhận cần shop.refund");
      await as("chu.app@tapeasy.vn");
      await run(`await cloudEvents.updateOrder(${S(o.id)}, { status:"cancelled" }); await cloudAdmin.setRole(${S(U.shop)}, "shop_manager", { px:[], reason:"Khôi phục" });`);
      await as("ana@tapeasy.vn");
      assert.equal(app.ev("state.isAdmin"), true, "Phân tích có orders.view → thấy (chỉ đọc)");
      assert.equal(await J(`return (await cloudEvents.allOrders()).length`), 1);
      assert.equal((await errOf(`await cloudEvents.updateOrder(${S(o.id)}, { status:"delivered" })`)).code, "permission-denied");
      await as("mod@tapeasy.vn");
      assert.equal(app.ev("state.isAdmin"), false, "Kiểm duyệt viên không có công cụ sự kiện / cửa hàng");
      await as("chu.app@tapeasy.vn");
      const acts = await J(`return (await cloudAdmin.listAudit({})).map(e=> e.action)`);
      ["challenge.save","order.update","access.denied"].forEach(a=> assert.ok(acts.includes(a), "thiếu audit " + a));
    });

    t.test("Cài đặt: Super Admin sửa phí ship, KHÔNG sửa tài khoản nhận tiền; Owner sửa (xác thực lại) → áp vào gian hàng, audit che số tài khoản", async ()=>{
      await as("sa@tapeasy.vn");
      await run(`await cloudAdmin.saveSettings({ shippingFee:25000, freeShipFrom:399000, hotline:"0900 000 111" })`);
      assert.equal(app.ev("TapShop.core.CFG.shippingFee"), 25000);
      assert.equal(app.ev("TapShop.core.totals([{ price:100000, qty:1 }]).shipping"), 25000);
      assert.equal((await errOf(`await cloudAdmin.saveSettings({ bank:{ bankName:"MB", bankBin:"970422", accountNo:"999999999", accountName:"KE GIAN" } })`)).code, "permission-denied");
      assert.equal((await errOf(`await cloudAdmin.saveSettings({ shippingFee:-5 })`)).code, "admin/invalid");
      await as("chu.app@tapeasy.vn");
      assert.equal((await errOf(`await cloudAdmin.saveSettings({ bank:{ bankName:"VCB", bankBin:"97043", accountNo:"0011001234567", accountName:"CONG TY TAPEASY" } })`)).code, "admin/invalid");
      const t0 = app.ev("Date.now()"); app.setNow(t0 + 6 * 60000);
      assert.equal((await errOf(`await cloudAdmin.saveSettings({ bank:{ bankName:"Vietcombank", bankBin:"970436", accountNo:"0011001234567", accountName:"CONG TY TAPEASY" } })`)).code, "rbac/step-up");
      await run(`await TE_RBAC.stepUp("matkhau1"); await cloudAdmin.saveSettings({ bank:{ bankName:"Vietcombank", bankBin:"970436", accountNo:"0011001234567", accountName:"cong ty tapeasy" } })`);
      app.setNow(null);
      assert.equal(app.ev("TapShop.core.CFG.bank.accountNo + '|' + TapShop.core.CFG.bank.accountName"), "0011001234567|CONG TY TAPEASY");
      const a = await J(`return (await cloudAdmin.listAudit({ q:"settings.payment" }))[0]`);
      assert.ok(a && JSON.stringify(a.details).includes("4567") && !JSON.stringify(a.details).includes("0011001234567"), "audit che số tài khoản");
    });

    t.test("Chuyển nhượng Owner (demo): cần cụm từ; Owner cũ → Super Admin; luôn đúng 1 Owner", async ()=>{
      await as("chu.app@tapeasy.vn");
      assert.equal((await errOf(`await cloudAdmin.transferOwnership(${S(U.sup)}, { confirm:"ok" })`)).code, "admin/confirm");
      await run(`await cloudAdmin.transferOwnership(${S(U.sup)}, { confirm:"CHUYỂN NHƯỢNG", reason:"Bàn giao" })`);
      assert.equal(app.ev("TE_RBAC.role()"), "super_admin");
      const d = app.evj("cloudAdmin._demo.load()");
      assert.equal(d.owner, U.sup); assert.equal(Object.values(d.roles).filter(r=> r.role === "owner").length, 1);
      assert.equal((await errOf(`await cloudAdmin.setRole(${S(U.sup)}, "admin")`)).code, "admin/owner-protected", "Owner cũ không hạ được Owner mới");
      await as("sa@tapeasy.vn");
      await run(`await cloudAdmin.transferOwnership(${S(U.owner)}, { confirm:"CHUYỂN NHƯỢNG", reason:"Trả lại" })`);
      assert.equal(app.evj("cloudAdmin._demo.load().owner"), U.owner);
    });

    t.test("Kiểm duyệt + PT + hỗ trợ + thông báo: hàng đợi, xác minh PT, trả lời hỗ trợ, giới hạn 5 thông báo/24h, đúng đối tượng", async ()=>{
      // người dùng báo cáo routine 3 lần → bị ẩn → vào hàng đợi
      const rid = await J(`const r = (await cloud.social.listRoutines())[0]; return r.id;`);
      for(const em of ["lan@mail.vn", "ana@tapeasy.vn", "sp@x.vn"]){
        if(em === "sp@x.vn") await signUp(em, "Người thứ ba"); else await run(`await cloud.signOut(); await cloud.signIn(${S(em)}, "matkhau1")`);
        // fix-pt vòng 2 (QC-14): báo cáo routine tính theo trọng số tuổi tài khoản (≥ 7 ngày = 1) → cho người báo cáo đủ tuổi
        await run(`const k = "fitkit_cloud_demo_v1", db = JSON.parse(localStorage.getItem(k) || "{}"); Object.values(db.users || {}).forEach(u=>{ if(u.email === ${S(em)}) u.createdAt = Date.now() - 30*864e5; }); localStorage.setItem(k, JSON.stringify(db));`);
        await run(`await cloud.social.reportRoutine(${S(rid)}, "Spam")`);
      }
      await run(`await cloud.signOut(); await cloud.signIn("lan@mail.vn", "matkhau1"); await cloudAdmin.openTicket({ topic:"order", text:"Đơn của mình chưa được xác nhận sau 3 ngày" })`);
      await as("mod@tapeasy.vn");
      let q = await J("return await cloudAdmin.modQueue()");
      const it = q.find(x=> x.type === "routine" && x.id === rid); assert.ok(it && it.count === 3 && it.hidden, JSON.stringify(q.map(x=> [x.type, x.id, x.count])));
      await run(`await cloudAdmin.moderate(${S(it)}, "keep")`);
      assert.equal(app.ev(`cloud.social.moderation.isHidden(cloud.social._demo.load().routines[${S(rid)}])`), false, "giữ → khôi phục hiển thị");
      assert.equal((await errOf(`await cloudAdmin.setFeatured(${S(rid)}, true)`)).code, "permission-denied", "Kiểm duyệt viên không ghim");
      assert.equal((await errOf(`await cloudAdmin.verifyPT("sample_pt_1", true, "ok")`)).code, "permission-denied");
      await as("ad@tapeasy.vn");
      await run(`await cloudAdmin.verifyPT("sample_pt_1", true, "Đã tra số chứng chỉ NASM")`);
      assert.equal(app.evj(`cloudAdmin.ptStatus("sample_pt_1")`).verified, true);
      assert.equal((await errOf(`await cloudAdmin.verifyPT("sample_pt_2", false, "")`)).code, "admin/reason");
      await as("cskh@tapeasy.vn");
      const tks = await J(`return await cloudAdmin.listTickets("open")`);
      const mine = tks.find(x=> !x.sample); assert.ok(mine);
      await run(`await cloudAdmin.replyTicket(${S(mine.id)}, "Shop đã xác nhận đơn, dự kiến giao 2 ngày", false)`);
      assert.equal((await errOf(`await cloudAdmin.broadcast({ title:"Xin chào", body:"Thông báo thử nghiệm" })`)).code, "permission-denied", "Hỗ trợ không gửi thông báo");
      await as("ad@tapeasy.vn");
      for(let i = 0; i < 5; i++) await run(`await cloudAdmin.broadcast({ title:"Thông báo " + ${i}, body:"Nội dung số " + ${i} + " cho PT", audience: ${i} ? "all" : "pt", level: ${i} === 4 ? "important" : "info" })`);
      assert.equal((await errOf(`await cloudAdmin.broadcast({ title:"Thứ sáu", body:"Vượt giới hạn trong ngày" })`)).code, "admin/rate");
      await run(`await cloud.signOut(); await cloud.signIn("lan@mail.vn", "matkhau1")`);
      const seen = await J(`return (await cloudAdmin.activeBroadcasts()).map(b=> b.audience)`);
      assert.equal(seen.length, 4, "học viên không thấy thông báo chỉ dành cho PT");
      assert.equal(await J(`return (await cloudAdmin.myTickets())[0].replies.length`), 1, "người dùng thấy câu trả lời");
    });

    t.test("Bảng điều khiển: mỗi mục chỉ hiện khi can() — Phân tích / Kiểm duyệt / Owner; danh sách người dùng escape HTML", async ()=>{
      const navOf = ()=> app.evj("TE_ADMIN.visibleSections().map(s=> s.id)");
      await as("ana@tapeasy.vn");
      assert.deepEqual(navOf(), ["overview", "users", "pt", "shop"], "Phân tích: chỉ mục xem (PT, đơn hàng — chỉ đọc)");
      assert.equal(app.ev("TE_RBAC.can('shop.orders') || TE_RBAC.can('pt.verify')"), false);
      await as("mod@tapeasy.vn");
      assert.deepEqual(navOf(), ["overview", "users", "moderation", "community"]);   // R3 (agent admin): thêm mục "Bài đăng cộng đồng" (community.moderate / reviews.moderate / community.feature)
      await as("cskh@tapeasy.vn");
      assert.deepEqual(navOf(), ["overview", "users", "shop", "support"]);
      await as("chu.app@tapeasy.vn");
      assert.deepEqual(navOf(), ["overview","users","team","pt","moderation","community","content","events","shop","support","broadcast","settings","audit"]);
      await run(`TE_ADMIN.open("users"); await new Promise(r=> setTimeout(r, 120));`);
      const html = app.lastHtml("adm-u-list");
      assert.ok(html.includes("Lan &lt;img src=x onerror=alert(1)&gt;") && !html.includes("<img src=x"), "tên người dùng phải được escape");
      await run(`TE_ADMIN._A.sec = "team"; TE_ADMIN.render(); await new Promise(r=> setTimeout(r, 120));`);
      assert.ok(app.lastHtml("adm-body").includes("Ma trận quyền (36 quyền × 10 vai trò)"));
      await run(`TE_ADMIN._A.sec = "audit"; TE_ADMIN.render(); await new Promise(r=> setTimeout(r, 150));`);
      assert.ok(app.lastHtml("adm-body").includes("chuỗi băm khớp"), "nhật ký toàn vẹn");
      await run(`TE_ADMIN.close()`);
    });

    t.test("Nhật ký kiểm toán chỉ-thêm: mọi thay đổi được ghi, chuỗi băm khớp; sửa / xoá trong localStorage bị phát hiện; API không có hàm sửa/xoá", async ()=>{
      await as("chu.app@tapeasy.vn");
      const list = await J("return await cloudAdmin.listAudit({})");
      const acts = new Set(list.map(e=> e.action));
      ["owner.bootstrap","owner.bootstrap_failed","role.assign","role.revoke","role.denied","user.ban","user.unban","admin.login","admin.login_failed","settings.update","settings.payment","owner.transfer","pt.verify","ticket.reply","broadcast.send","mod.routine.keep","challenge.save","order.update","access.denied"]
        .forEach(a=> assert.ok(acts.has(a), "thiếu bản ghi " + a));
      assert.ok(list.every(e=> e.actor === null || e.actor.uid), "mỗi bản ghi có người thực hiện");
      assert.equal((await J("return await cloudAdmin.verifyAudit()")).ok, true);
      assert.deepEqual(app.evj("Object.keys(cloudAdmin).filter(k=> /audit/i.test(k))").sort(), ["appendAudit", "listAudit", "verifyAudit"]);
      const raw = JSON.parse(app.localStorage.getItem("tapeasy_admin_demo_v1"));
      const i = raw.audit.findIndex(e=> e.action === "user.ban");
      raw.audit[i].details.reason = "đã sửa lén"; app.localStorage.setItem("tapeasy_admin_demo_v1", JSON.stringify(raw));
      const v1 = await J("return await cloudAdmin.verifyAudit()"); assert.equal(v1.ok, false); assert.equal(v1.brokenAt, i);
      raw.audit.splice(i, 1); app.localStorage.setItem("tapeasy_admin_demo_v1", JSON.stringify(raw));
      assert.equal((await J("return await cloudAdmin.verifyAudit()")).ok, false, "xoá bản ghi bị phát hiện");
    });

    t.test("teCan bị module khác gán lại vẫn gọi TE_RBAC (bản cũ giữ ở teCan._legacy)", ()=>{
      app.run("window.teCan = function(p){ return true; };");
      assert.equal(app.ev("teCan('settings.payment')"), app.ev("TE_RBAC.can('settings.payment')"));
      assert.equal(app.ev("typeof teCan._legacy"), "function");
      app.run("TE_RBAC.logout();");
      assert.equal(app.ev("teCan('users.view')"), false);
    });
  },
};

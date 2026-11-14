/* =========================================================================
   Vòng R3 (14/11/2026) — agent CLOUD · docs/qa/R3-cloud.md
   Chạy riêng: node tests/run.js --only 82-r3
   - R3-CLOUD-xx: lỗi đã sửa trong cloud.js / pt.js / firestore.rules / functions
   - Nâng cấp: quên mật khẩu (link trung tính + chờ 60 s, OTP email, OTP số điện thoại sau cờ), tài khoản liên kết,
     sao lưu & đồng bộ fitkit_state_v1 theo tài khoản (khúc ≤ 250 000 ký tự, gộp theo updatedAt, hỏi trước khi ghi đè),
     nhật ký đồng ý, xuất dữ liệu, xoá tài khoản, Cloud Functions OTP (băm mã, 10 phút, 5 lần, rate-limit), trang pháp lý.
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Module = require("module");
const { assert, expectNone } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
const exists = f=> fs.existsSync(path.join(ROOT, f));
const clone = v=> v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const sleep = ms=> new Promise(r=> setTimeout(r, ms));

/* ---------------------------------------------------------------------
   cloud.js chạy RIÊNG trong vm với Firebase GIẢ (Auth + Firestore trong bộ nhớ) → kiểm động cơ firebase mà không cần mạng
   --------------------------------------------------------------------- */
function miniCloud(opts){
  opts = opts || {};
  const store = new Map(), ls = new Map(); let auto = 0;
  const log = { resetSent: [], batches: 0 };
  const snap = p=> ({ id: p.split("/").pop(), exists: store.has(p), data: ()=> clone(store.get(p)), ref: docRef(p) });
  function docRef(p){ return { id: p.split("/").pop(), path: p, get: async ()=> snap(p),
    set: async (d, o)=>{ store.set(p, o && o.merge ? Object.assign({}, store.get(p), clone(d)) : clone(d)); },
    update: async d=>{ store.set(p, Object.assign({}, store.get(p), clone(d))); }, delete: async ()=>{ store.delete(p); },
    collection: n=> colRef(p + "/" + n) }; }
  function colRef(p){ const q = { get: async ()=> ({ docs: [...store.keys()].filter(k=> k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).map(snap) }), where(){ return { get: async ()=> ({ docs: [] }), where(){ return this; } }; } };
    return Object.assign(q, { doc: id=> docRef(p + "/" + (id || ("auto" + (++auto)))) }); }
  const db = { collection: n=> colRef(n), enablePersistence: async ()=>{},
    batch(){ const ops = []; return { set: (r, d)=> ops.push(()=> store.set(r.path, clone(d))), delete: r=> ops.push(()=> store.delete(r.path)), update: (r, d)=> ops.push(()=> store.set(r.path, Object.assign({}, store.get(r.path), clone(d)))),
      commit: async ()=>{ log.batches++; if(opts.failWrite) throw Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" }); ops.forEach(f=> f()); } }; } };
  const user = { uid: "U1", email: "a@b.vn", displayName: "An", providerData: [{ providerId: "password", email: "a@b.vn" }], emailVerified: true };
  const auth = { currentUser: opts.loggedOut ? null : user,
    onAuthStateChanged(cb){ setTimeout(()=> cb(opts.loggedOut ? null : user), 0); }, getRedirectResult: async ()=> null, signOut: async ()=>{},
    signInWithEmailAndPassword: async ()=>{ throw Object.assign(new Error("Firebase: Error (auth/internal-error)."), { code: "auth/internal-error" }); },
    sendPasswordResetEmail: async em=>{ log.resetSent.push(em); throw Object.assign(new Error("Firebase: Error (auth/user-not-found)."), { code: "auth/user-not-found" }); } };
  const firebase = { apps: [{ name: "[DEFAULT]" }], initializeApp(){},
    auth: Object.assign(()=> auth, { EmailAuthProvider: { credential(){ return {}; } } }),
    firestore: Object.assign(()=> db, { FieldValue: { serverTimestamp: ()=> ({ __st: 1 }), delete: ()=> ({ __del: 1 }) } }) };
  const localStorage = { getItem: k=> ls.has(k) ? ls.get(k) : null, setItem: (k, v)=> ls.set(String(k), String(v)), removeItem: k=> ls.delete(k), key: i=> [...ls.keys()][i] ?? null, get length(){ return ls.size; } };
  const winL = {};
  const sandbox = { FIREBASE_CONFIG: { apiKey: opts.noConfig ? "" : "test-key" }, localStorage, console: { log(){}, warn(){}, error(){}, info(){} },
    document: { getElementById(){ return null; }, addEventListener(){}, createElement(){ return {}; }, body: { appendChild(){} },
      head: { appendChild(s){ setTimeout(()=>{ if(opts.scriptFails){ s.onerror && s.onerror(); } else { s.onload && s.onload(); } }, 0); } } },
    navigator: { onLine: true }, crypto: require("crypto").webcrypto, setTimeout: (fn, ms)=> (ms > 1000 ? 0 : setTimeout(fn, ms)), clearTimeout(){}, Date, JSON, Math, Promise };
  if(!opts.scriptFails) sandbox.firebase = firebase;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(`var window = globalThis; window.addEventListener = (t, fn)=>{ (globalThis.__wl = globalThis.__wl || {})[t] = fn; };`, ctx);
  vm.runInContext(read("cloud.js"), ctx, { filename: "cloud.js" });
  return { ctx, store, ls, log, user, ev: code=> vm.runInContext(code, ctx), giveFirebase(){ ctx.firebase = firebase; } };
}

/* ---------------------------------------------------------------------
   functions/account.js với Admin SDK + firebase-functions GIẢ LẬP
   --------------------------------------------------------------------- */
function loadAccountFns(env){
  const store = new Map(); const users = new Map(); const calls = { updateUser: [], revoke: [], mail: [] };
  const DEL = { __del: true };
  const apply = (old, d)=>{ const out = Object.assign({}, old || {}); Object.keys(d || {}).forEach(k=>{ if(d[k] && d[k].__del) delete out[k]; else out[k] = clone(d[k]); }); return out; };
  const write = (p, d, merge)=> store.set(p, apply(merge ? store.get(p) : {}, d));
  const snap = p=> ({ id: p.split("/").pop(), exists: store.has(p), data: ()=> clone(store.get(p)), ref: docRef(p) });
  function docRef(p){ return { path: p, id: p.split("/").pop(), get: async ()=> snap(p), set: async (d, o)=> write(p, d, o && o.merge), delete: async ()=>{ store.delete(p); }, collection: n=> colRef(p + "/" + n) }; }
  function colRef(p){ const mk = f=> ({ where: (k, op, v)=> mk(f.concat([[k, v]])), get: async ()=> ({ docs: [...store.keys()].filter(k=> k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).map(snap).filter(d=> f.every(([k, v])=> (d.data() || {})[k] === v)) }) });
    return Object.assign(mk([]), { doc: id=> docRef(p + "/" + id) }); }
  const db = { collection: n=> colRef(n),
    collectionGroup: n=>{ const mk = f=> ({ where: (k, op, v)=> mk(f.concat([[k, v]])), get: async ()=> ({ docs: [...store.keys()].filter(k=> k.split("/").slice(-2)[0] === n).map(snap).filter(d=> f.every(([k, v])=> (d.data() || {})[k] === v)) }) }); return mk([]); },
    runTransaction: async fn=>{ const ops = []; const r = await fn({ get: ref=> ref.get(), set: (ref, d, o)=> ops.push(()=> write(ref.path, d, o && o.merge)) }); ops.forEach(f=> f()); return r; } };
  const adminMock = { initializeApp(){}, firestore: Object.assign(()=> db, { FieldValue: { delete: ()=> DEL, serverTimestamp: ()=> Date.now() } }),
    auth: ()=> ({ getUserByEmail: async em=>{ const u = [...users.values()].find(x=> x.email === em); if(!u) throw Object.assign(new Error("no user"), { code: "auth/user-not-found" }); return u; },
      updateUser: async (uid, patch)=>{ calls.updateUser.push({ uid, patch }); }, revokeRefreshTokens: async uid=>{ calls.revoke.push(uid); } }) };
  class HttpsError extends Error { constructor(code, message){ super(message); this.code = code; } }
  const param = (name, o)=> ({ value: ()=> (name in env ? env[name] : (o && o.default) || "") });
  const mocks = { "firebase-admin": adminMock, "firebase-functions/v2/https": { onCall: (o, fn)=> fn || o, HttpsError },
    "firebase-functions/params": { defineSecret: n=> param(n), defineString: (n, o)=> param(n, o) }, "firebase-functions/logger": { info(){}, warn(){}, error(){} } };
  const file = path.join(ROOT, "functions", "account.js");
  const orig = Module._load;
  Module._load = function(req){ if(mocks[req]) return mocks[req]; return orig.apply(this, arguments); };
  let mod; try{ delete require.cache[file]; mod = require(file); } finally{ Module._load = orig; }
  const fetchFake = async (url, init)=>{ calls.mail.push({ url, headers: init.headers, body: JSON.parse(init.body) }); return { ok: !env.__mailFails, status: env.__mailFails ? 500 : 200 }; };
  return { T: mod._accountTest, mod, store, users, calls, fetchFake, HttpsError };
}
const errOf = async p=>{ try{ await p; return null; }catch(e){ return { code: e.code, message: e.message, waitSec: e.waitSec }; } };

module.exports = {
  name: "Vòng R3 — Cloud: tài khoản, quên mật khẩu/OTP, liên kết, sao lưu & đồng bộ, đồng ý, pháp lý",
  area: "cloud.js · pt.js · firestore.rules · functions/account.js · firebase-config.js · privacy-policy.html · terms.html · docs",
  async define(t){
    const cloudJs = read("cloud.js"), ptJs = read("pt.js"), rules = read("firestore.rules");
    const E = (app, code)=> errOf(app.ev(code));
    const copyServer = (from, to)=> ["fitkit_cloud_demo_v1", "fitkit_cloud_demo_state_v1"].forEach(k=>{ const v = from.localStorage.getItem(k); if(v != null) to.localStorage.setItem(k, v); });

    /* ================= LỖI ĐÃ SỬA ================= */
    t.test("R3-CLOUD-01: có cấu hình Firebase nhưng không tải được SDK → 'degraded': KHÔNG cho đăng ký/đăng nhập vào máy chủ giả; có mạng lại → retryInit vào firebase", async ()=>{
      const m = miniCloud({ scriptFails: true });
      await m.ev("cloud.init()");
      assert.equal(m.ev("cloud.degraded"), true); assert.equal(m.ev("cloud.isLoggedIn()"), false);
      const e = await errOf(m.ev(`cloud.signUp("ma@x.vn", "matkhau1", "Ma")`));
      assert.equal(e.code, "cloud/offline"); assert.match(e.message, /Chưa kết nối được máy chủ/);
      assert.equal(m.ls.has("fitkit_cloud_demo_v1"), false, "không được tạo tài khoản 'ma' trong kho demo");
      assert.equal((await errOf(m.ev(`cloud.signIn("ma@x.vn", "matkhau1")`))).code, "cloud/offline");
      assert.equal(m.ev("cloud.sync.status().state"), "offline");
      m.giveFirebase();                                   // "có mạng lại": SDK đã sẵn
      assert.equal(await m.ev("cloud.retryInit()"), true);
      assert.equal(m.ev("cloud.mode"), "firebase"); assert.equal(m.ev("cloud.degraded"), false); assert.equal(m.ev("cloud.user.uid"), "U1");
    });
    t.test("R3-CLOUD-01b: chưa cấu hình Firebase → vẫn là chế độ demo bình thường (không degraded)", async ()=>{
      const m = miniCloud({ noConfig: true, scriptFails: true });
      await m.ev("cloud.init()");
      assert.equal(m.ev("cloud.mode"), "demo"); assert.equal(m.ev("cloud.degraded"), false);
    });
    t.test("R3-CLOUD-03: quên mật khẩu trả lời TRUNG TÍNH (email không tồn tại vẫn 'đã gửi'), kiểm định dạng, chờ 60 giây mới gửi lại", async ()=>{
      const app = await t.app();
      await app.ev(`cloud.signUp("co@x.vn", "matkhau1", "Có")`); await app.ev("cloud.signOut()");
      assert.equal((await E(app, `cloud.resetPassword("khong-phai-email")`)).code, "auth/invalid-email");
      const a = await app.ev(`cloud.resetPassword("co@x.vn")`), b = await app.ev(`cloud.resetPassword("khongco@x.vn")`);
      assert.deepEqual(clone(a), clone(b), "kết quả phải giống hệt nhau dù email có/không có tài khoản");
      assert.equal(a.sent, true); assert.equal(a.simulated, true, "demo phải báo rõ là mô phỏng");
      const again = await E(app, `cloud.resetPassword(" CO@x.vn ")`);
      assert.equal(again.code, "cooldown"); assert.ok(again.waitSec > 0 && again.waitSec <= 60); assert.match(again.message, /Vui lòng đợi \d+ giây/);
      assert.ok(app.ev(`cloud.resendWait("reset", "co@x.vn")`) > 50);
      app.setNow(Date.now() + 61000);
      assert.equal(app.ev(`cloud.resendWait("reset", "co@x.vn")`), 0);
      assert.equal((await app.ev(`cloud.resetPassword("co@x.vn")`)).sent, true);
      app.setNow(null);
      // Firebase: auth/user-not-found bị nuốt → vẫn { sent:true }
      const m = miniCloud({ loggedOut: true }); await m.ev("cloud.init()");
      const r = await m.ev(`cloud.resetPassword("ai-do@x.vn")`);
      assert.equal(r.sent, true); assert.equal(r.simulated, false); assert.deepEqual(m.log.resetSent, ["ai-do@x.vn"]);
      assert.ok(!/"auth\/user-not-found": "Không tìm thấy tài khoản/.test(cloudJs), "không còn thông báo 'Không tìm thấy tài khoản với email này'");
    });
    t.test("R3-CLOUD-04: lỗi Firebase tiếng Anh không lọt ra giao diện — auth/*, permission-denied, quota, mất mạng đều có câu tiếng Việt", async ()=>{
      const m = miniCloud({ loggedOut: true }); await m.ev("cloud.init()");
      const e = await errOf(m.ev(`cloud.signIn("a@b.vn", "x")`));
      assert.equal(e.code, "auth/internal-error"); assert.ok(!/Firebase/i.test(e.message), e.message); assert.match(e.message, /sự cố|thử lại/);
      const m2 = miniCloud({ failWrite: true }); await m2.ev("cloud.init()");
      m2.ev(`globalThis.__st = { onboarded:true, workoutLog:{} }; cloud.sync.attach({ getState: ()=> globalThis.__st, applyState: s=>{ globalThis.__st = s; } });`);
      await m2.ev(`cloud.consent.record({ terms:true, age:true, health:true }, "t")`);
      const se = await errOf(m2.ev("cloud.sync.syncNow()"));
      assert.equal(se.message, "Bạn không có quyền thực hiện thao tác này."); assert.equal(m2.ev("cloud.sync.status().error"), se.message);
      const need = ["resource-exhausted", "unauthenticated", "deadline-exceeded", "unavailable", "auth/quota-exceeded", "auth/invalid-phone-number", "auth/invalid-verification-code",
        "auth/code-expired", "auth/credential-already-in-use", "auth/provider-already-linked", "auth/user-disabled", "link/last-method", "cloud/offline"];
      expectNone(need.filter(k=> !new RegExp(`"${k.replace(/[/-]/g, "\\$&")}":\\s*"[^"]*[àáạảãâăèéêìíòóôơùúưỳýđ]`, "i").test(cloudJs)), "thiếu thông báo tiếng Việt cho mã lỗi");
    });
    t.test("R3-CLOUD-07: tài khoản nhiều cách đăng nhập — isSocialUser/hasPassword theo cách đăng nhập THỰC TẾ, xoá tài khoản đòi đúng mật khẩu", async ()=>{
      const app = await t.app();
      await app.ev("cloud.signInWithGoogle()");
      assert.equal(app.ev("cloud.isSocialUser"), true); assert.equal(app.ev("cloud.hasPassword"), false);
      await app.ev(`cloud.setPassword("matkhau9")`);
      assert.equal(app.ev("cloud.isSocialUser"), false, "đã đặt mật khẩu → không còn là tài khoản 'chỉ mạng xã hội'"); assert.equal(app.ev("cloud.hasPassword"), true);
      assert.equal((await E(app, `cloud.deleteAccount("sai")`)).message, "Sai mật khẩu.");
      await app.ev(`cloud.deleteAccount("matkhau9")`);
      assert.equal(app.ev("cloud.isLoggedIn()"), false);
    });
    t.test("R3-CLOUD-08/09: đăng xuất không nuốt lỗi; bộ đếm 'gửi lại' (setInterval) dừng khi rời màn Quên mật khẩu", async ()=>{
      assert.match(ptJs, /try\{ await cloud\.signOut\(\); \}catch\(e\)\{ toast\(e\.message, "error"\); return; \}/);
      const app = await t.app({ state: false });
      const ticks = ()=> app.held.filter(h=> h.kind === "interval" && /resendWait|paint/.test(String(h.fn))).length;
      app.run(`showAuth("forgot")`);
      app.run(`document.getElementById("au-email").value = "tick@x.vn"`);
      app.run(`document.getElementById("au-submit").click()`); await sleep(200);
      assert.match(app.lastHtml("fg-body"), /Nếu <b>tick@x\.vn<\/b> đã đăng ký/, "màn 'đã gửi' trung tính");
      assert.match(app.lastHtml("fg-body"), /Bản dùng thử — không gửi thật/);
      assert.equal(ticks(), 1, "đang đếm ngược 60 s");
      app.run(`showAuth("login")`);
      assert.equal(ticks(), 0, "rời màn → clearInterval");
    });

    /* ================= A. QUÊN MẬT KHẨU: OTP ================= */
    t.test("A · cờ phoneOtp/emailOtp mặc định TẮT → ẩn hoàn toàn khỏi giao diện, API từ chối; firebase-config.js không chứa khoá", async ()=>{
      const cfg = read("firebase-config.js");
      assert.match(cfg, /phoneOtp:\s*false/); assert.match(cfg, /emailOtp:\s*false/);
      assert.match(cfg, /apiKey:\s*""/, "apiKey phải để trống — chủ dự án tự điền");
      assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(cfg + cloudJs + ptJs + read("functions/account.js")), "không có khoá API trong mã");
      const app = await t.app({ state: false });
      assert.equal(app.ev("cloud.otp.enabled()"), false); assert.equal(app.ev("cloud.phone.enabled()"), false);
      app.run(`showAuth("forgot")`);
      const html = app.lastHtml("auth-body") + app.lastHtml("fg-body");
      assert.ok(!/Số điện thoại|Mã qua email|data-fg=/.test(html), "không được hiện lựa chọn OTP khi cờ tắt");
      assert.match(html, /Gửi link đặt lại/);
      assert.equal((await E(app, `cloud.otp.request("a@b.vn")`)).code, "otp/disabled");
      assert.equal((await E(app, `cloud.phone.start("0912345678")`)).code, "phone/disabled");
      assert.ok(!app.ev("cloud.linked.list().some(p=> p.id === 'phone')"), "mục Số điện thoại không hiện trong Tài khoản liên kết");
    });
    t.test("A3 · OTP email (demo, cờ bật): mô phỏng trung thực — mã 6 số, sai 5 lần khoá mã, đúng mã → đổi mật khẩu; giao diện ghi 'không gửi thật'", async ()=>{
      const app = await t.app({ state: false });
      await app.ev(`cloud.signUp("otp@x.vn", "matkhaucu", "Otp")`); await app.ev("cloud.signOut()");
      app.run("FK_FEATURES.emailOtp = true");
      app.run(`showAuth("forgot")`);
      assert.match(app.lastHtml("auth-body"), /data-fg="otp"[\s\S]*data-fg="link"/, "có 2 lựa chọn: mã qua email + link");
      const r = await app.ev(`cloud.otp.request("otp@x.vn")`);
      assert.equal(r.simulated, true); assert.match(r.demoCode, /^\d{6}$/);
      assert.equal((await E(app, `cloud.otp.request("otp@x.vn")`)).code, "cooldown", "gửi lại trong 60 s bị chặn");
      assert.equal((await E(app, `cloud.otp.verify("otp@x.vn", "12", "matkhaumoi")`)).code, "auth/missing-verification-code");
      assert.equal((await E(app, `cloud.otp.verify("otp@x.vn", "${r.demoCode}", "123")`)).code, "auth/weak-password");
      const wrong = r.demoCode === "000000" ? "111111" : "000000";
      for(let i = 0; i < 4; i++) assert.equal((await E(app, `cloud.otp.verify("otp@x.vn", "${wrong}", "matkhaumoi")`)).code, "otp/invalid");
      assert.equal((await E(app, `cloud.otp.verify("otp@x.vn", "${wrong}", "matkhaumoi")`)).code, "otp/too-many", "lần sai thứ 5 → khoá");
      assert.equal((await E(app, `cloud.otp.verify("otp@x.vn", "${r.demoCode}", "matkhaumoi")`)).code, "otp/invalid", "mã đã bị huỷ");
      app.setNow(Date.now() + 61000);
      const r2 = await app.ev(`cloud.otp.request("otp@x.vn")`);
      assert.equal((await app.ev(`cloud.otp.verify("otp@x.vn", "${r2.demoCode}", "matkhaumoi")`)).ok, true);
      assert.equal((await E(app, `cloud.signIn("otp@x.vn", "matkhaucu")`)).message, "Email hoặc mật khẩu không đúng.");
      assert.equal((await app.ev(`cloud.signIn("otp@x.vn", "matkhaumoi")`)).email, "otp@x.vn");
      await app.ev("cloud.signOut()");
      // email không có tài khoản: vẫn "đã gửi", nhập mã → cùng thông báo như mã sai (không lộ)
      const r3 = await app.ev(`cloud.otp.request("khongco@x.vn")`);
      assert.equal(r3.sent, true);
      assert.equal((await E(app, `cloud.otp.verify("khongco@x.vn", "${r3.demoCode}", "matkhaumoi")`)).code, "otp/invalid");
      app.setNow(null);
      // giao diện bước nhập mã
      app.run(`showAuth("forgot"); renderForgot("otp", "code", { email:"otp@x.vn", demoCode:"246810" })`);
      const h = app.lastHtml("fg-body");
      assert.match(h, /Bản dùng thử — không gửi thật\. Mã thử của bạn: <b class="fk-demo-code">246810<\/b>/);
      assert.match(h, /autocomplete="one-time-code"/); assert.match(h, /inputmode="numeric"/);
    });
    t.test("A2 · OTP số điện thoại (demo, cờ bật): chuẩn hoá số VN, liên kết số → đăng nhập bằng OTP → đặt mật khẩu mới; số chưa liên kết bị từ chối", async ()=>{
      const app = await t.app({ state: false });
      app.run("FK_FEATURES.phoneOtp = true");
      assert.equal(app.ev(`cloud.phone.normalize("0912 345 678")`), "+84912345678");
      assert.equal(app.ev(`cloud.phone.normalize("84 912.345.678")`), "+84912345678");
      assert.equal(app.ev(`cloud.phone.normalize("+84912345678")`), "+84912345678");
      for(const bad of ["12345", "0112345678", "abc", "+8401234"]) assert.equal((await E(app, `cloud.phone.start("${bad}")`)).code, "auth/invalid-phone-number", bad);
      await app.ev(`cloud.signUp("sdt@x.vn", "matkhaucu", "Sđt")`);
      const s = await app.ev(`cloud.phone.start("0912345678", { link:true })`);
      assert.equal(s.simulated, true); assert.match(s.demoCode, /^\d{6}$/);
      const wrong = s.demoCode === "000000" ? "111111" : "000000";
      assert.equal((await E(app, `cloud.phone.confirm("${wrong}")`)).code, "auth/invalid-verification-code");
      assert.equal((await app.ev(`cloud.phone.confirm("${s.demoCode}")`)).linked, true);
      assert.deepEqual(clone(app.ev("cloud.linked.providers()")).sort(), ["password", "phone"]);
      assert.equal(app.ev("cloud.linked.list().find(p=> p.id === 'phone').detail"), "+84912345678");
      await app.ev("cloud.signOut()");
      app.setNow(Date.now() + 61000);
      const s2 = await app.ev(`cloud.phone.start("0912345678")`);
      const r = await app.ev(`cloud.phone.confirm("${s2.demoCode}")`);
      assert.equal(r.signedIn, true); assert.equal(app.ev("cloud.user.email"), "sdt@x.vn");
      await app.ev(`cloud.setPassword("matkhaumoi")`); await app.ev("cloud.signOut()");
      assert.equal((await app.ev(`cloud.signIn("sdt@x.vn", "matkhaumoi")`)).email, "sdt@x.vn");
      await app.ev("cloud.signOut()");
      const s3 = await app.ev(`cloud.phone.start("0987654321")`);
      assert.equal((await E(app, `cloud.phone.confirm("${s3.demoCode}")`)).code, "phone/not-linked");
      assert.equal(app.ev("cloud.isLoggedIn()"), false);
      app.setNow(null);
      assert.match(cloudJs, /isNewUser\)\{\s*try\{ await res\.user\.delete\(\)/, "Firebase: số chưa liên kết không được để lại tài khoản rỗng");
      assert.match(cloudJs, /RecaptchaVerifier\(el, \{ size: "invisible" \}\)/); assert.match(cloudJs, /addListener\("phoneCodeSent"/);
    });

    /* ================= B. TÀI KHOẢN LIÊN KẾT ================= */
    t.test("B · Liên kết / huỷ liên kết (demo): luôn giữ ≥ 1 cách đăng nhập; Google đã liên kết đăng nhập vào đúng tài khoản; trùng → báo đã dùng", async ()=>{
      const app = await t.app();
      const u = await app.ev(`cloud.signUp("lk@x.vn", "matkhau1", "Liên Kết")`);
      assert.deepEqual(clone(app.ev("cloud.linked.providers()")), ["password"]);
      assert.equal((await E(app, `cloud.linked.unlink("password")`)).code, "link/last-method");
      assert.equal(app.ev("cloud.linked.list().find(p=> p.id === 'password').canUnlink"), false);
      await app.ev(`cloud.linked.link("google")`);
      assert.deepEqual(clone(app.ev("cloud.linked.providers()")), ["password", "google"]);
      assert.equal((await E(app, `cloud.linked.link("google")`)).code, "auth/provider-already-linked");
      await app.ev("cloud.signOut()");
      assert.equal((await app.ev("cloud.signInWithGoogle()")).uid, u.uid, "Google đã liên kết → vào đúng tài khoản email");
      await app.ev(`cloud.linked.unlink("password")`);
      assert.deepEqual(clone(app.ev("cloud.linked.providers()")), ["google"]);
      assert.equal((await E(app, `cloud.linked.unlink("google")`)).code, "link/last-method");
      await app.ev("cloud.signOut()");
      assert.equal((await E(app, `cloud.signIn("lk@x.vn", "matkhau1")`)).message, "Email hoặc mật khẩu không đúng.", "đã huỷ mật khẩu → không đăng nhập bằng mật khẩu được");
      // tài khoản khác không liên kết được Google đã thuộc tài khoản trên
      await app.ev(`cloud.signUp("khac@x.vn", "matkhau2", "Khác")`);
      assert.equal((await E(app, `cloud.linked.link("google")`)).code, "auth/credential-already-in-use");
      await app.ev(`cloud.linked.link("facebook")`); await app.ev(`cloud.linked.unlink("facebook")`);
      await app.ev("cloud.signOut()");
      // xử lý account-exists-with-different-credential: giữ credential → tự liên kết sau khi đăng nhập đúng cách cũ
      assert.match(cloudJs, /account-exists-with-different-credential" && e\.credential\)\{\s*pendingLink = /);
      assert.match(cloudJs, /await u\.linkWithCredential\(p\.credential\); lastAutoLinked = p\.kind/);
      assert.match(cloudJs, /linkUser\.linkWithPopup\(provider\)/); assert.match(cloudJs, /if\(linkUser\) return linkUser\.linkWithCredential\(credential\)/);
    });
    t.test("B · Giao diện 'Tài khoản liên kết' + thẻ Tài khoản: có đủ mục, escape, nút Huỷ bị khoá khi chỉ còn 1 cách", async ()=>{
      const app = await t.app();
      await app.ev(`cloud.signUp("ui@x.vn", "matkhau1", "<img src=x onerror=alert(1)>")`);
      app.run("renderAccountCard()");
      const card = app.lastHtml("profile-account-card");
      for(const s of ["Sao lưu & đồng bộ", "Tài khoản liên kết", "Xuất dữ liệu của tôi", "Điều khoản sử dụng", "Chính sách bảo mật", "Xoá tài khoản"]) assert.ok(card.includes(s), "thiếu mục: " + s);
      assert.ok(!card.includes("<img src=x"), "tên người dùng phải được escape");
      app.run("openLinkedSheet()");
      const sh = app.lastHtml("sheet-content");
      assert.match(sh, /data-unlink="password" disabled/); assert.match(sh, /data-link="google"/); assert.match(sh, /data-link="apple"/); assert.match(sh, /data-link="facebook"/);
      assert.ok(!/data-link="phone"/.test(sh));
    });

    /* ================= E. ĐỒNG Ý ================= */
    t.test("E · Màn đăng ký: 3 ô tích RIÊNG, KHÔNG tích sẵn; thiếu ô bắt buộc → không tạo tài khoản; nhật ký đồng ý ghi loại + phiên bản + thời điểm", async ()=>{
      const app = await t.app({ state: false });
      app.run(`showAuth("signup")`);
      const html = app.lastHtml("auth-body");
      for(const id of ["au-agree", "au-age", "au-health"]) assert.match(html, new RegExp(`<input type="checkbox" id="${id}">`), id + " phải là ô tích không tích sẵn");
      assert.ok(!/type="checkbox"[^>]*checked/.test(html), "không ô nào được tích sẵn");
      assert.match(html, /dữ liệu sức khoẻ/); assert.match(html, /đủ 16 tuổi/); assert.match(html, /cha mẹ\/người giám hộ/);
      const set = (id, v)=> app.run(`document.getElementById("${id}").${typeof v === "boolean" ? "checked" : "value"} = ${JSON.stringify(v)}`);
      set("au-name", "Mai"); set("au-email", "mai@x.vn"); set("au-pw", "matkhau1");
      set("au-agree", false); set("au-age", false); set("au-health", false);
      app.run(`document.getElementById("au-submit").click()`); await sleep(50);
      assert.match(app.ev(`document.getElementById("au-err").textContent`), /đồng ý với Điều khoản/); assert.equal(app.ev("cloud.isLoggedIn()"), false);
      set("au-agree", true);
      app.run(`document.getElementById("au-submit").click()`); await sleep(50);
      assert.match(app.ev(`document.getElementById("au-err").textContent`), /đủ 16 tuổi/); assert.equal(app.ev("cloud.isLoggedIn()"), false);
      set("au-age", true);
      app.run(`document.getElementById("au-submit").click()`); await sleep(400);
      assert.equal(app.ev("cloud.isLoggedIn()"), true);
      const st = app.evj("cloud.consent.status()");
      assert.deepEqual([st.terms, st.age, st.health, st.base], [true, true, false, true], "sức khoẻ là tuỳ chọn — không tích thì không ghi đồng ý");
      const log = app.evj("cloud.consent.log()");
      assert.equal(log.length, 3);
      log.forEach(r=>{ assert.equal(r.version, app.ev("cloud.policyVersion")); assert.ok(r.at > 0); assert.equal(r.src, "signup"); assert.ok(["terms", "age", "health"].includes(r.type)); });
      const server = JSON.parse(app.localStorage.getItem("fitkit_cloud_demo_v1")).consents;
      assert.equal(Object.values(server)[0].length, 3, "nhật ký cũng nằm trên 'máy chủ'");
      assert.equal(app.ev("cloud.sync.status().state"), "no-consent", "chưa đồng ý dữ liệu sức khoẻ → KHÔNG sao lưu cloud");
      assert.equal(app.localStorage.getItem("fitkit_cloud_demo_state_v1"), null);
    });
    t.test("E · Đăng nhập trên máy mới kéo nhật ký đồng ý về (không hỏi lại); tài khoản chưa đồng ý → màn 'Trước khi bắt đầu'; rút đồng ý ghi dòng mới", async ()=>{
      const A = await t.app();
      await A.ev(`cloud.signUp("moi@x.vn", "matkhau1", "Mới")`);
      await A.ev(`cloud.consent.record({ terms:true, age:true, health:true }, "signup")`);
      const B = await t.app({ state: false }); copyServer(A, B);
      await B.ev(`cloud.signIn("moi@x.vn", "matkhau1")`);
      assert.equal(B.ev("cloud.consent.status().base"), false, "máy mới: chưa có nhật ký cục bộ");
      const st = await B.ev("cloud.consent.load()");
      assert.equal(st.base, true); assert.equal(st.health, true);
      await B.ev(`cloud.consent.record({ health:false }, "settings")`);
      assert.equal(B.ev("cloud.consent.status().health"), false);
      assert.equal(B.evj("cloud.consent.log()").filter(r=> r.type === "health").length, 2, "rút đồng ý = thêm dòng, không sửa dòng cũ");
      // tài khoản mạng xã hội đăng nhập từ màn Đăng nhập (chưa qua ô tích) → bị hỏi
      const C = await t.app({ state: false });
      await C.ev("cloud.signInWithGoogle()");
      await C.ev("postAuthRoute()");
      assert.match(C.lastHtml("auth-body"), /Trước khi bắt đầu/); assert.match(C.lastHtml("auth-body"), /id="au-health"/);
      assert.match(ptJs, /if\(cloud\.isLoggedIn\(\) && !cs\.base\)\{ showAuth\("consent"\); return; \}/);
    });

    /* ================= C. SAO LƯU & ĐỒNG BỘ ================= */
    t.test("C · Sao lưu theo tài khoản → đăng nhập MÁY KHÁC khôi phục đủ; khoá API / dữ liệu theo máy KHÔNG lên cloud", async ()=>{
      const A = await t.app({ state: { onboarded:true, authDone:true, workoutLog: { "2026-11-10": { dayKey:"T3", completedExerciseIds:["x1"], finishedAt: 5 } }, finishedDates: ["2026-11-10"] } });
      await A.ev(`cloud.signUp("sync@x.vn", "matkhau1", "Sync")`);
      await A.ev(`cloud.consent.record({ terms:true, age:true, health:true }, "signup")`);
      await sleep(50); await A.ev("cloud.sync.syncNow()");
      A.run(`state.waterLog["2026-11-11"] = 2.5; state.foodLog["2026-11-11"] = { breakfast:[{ name:"Phở bò", kcal:450 }] }; state.aiSettings.openaiKey = "sk-BI-MAT-123"; state.profile.weight = 71.5; saveState();`);
      assert.equal(A.ev("cloud.sync.status().pending"), true, "saveState → đánh dấu cần sao lưu");
      assert.ok(A.held.some(h=> h.kind === "timeout" && h.ms >= 8000), "đẩy có debounce ≥ 8 giây (không ghi cloud mỗi lần lưu)");
      await A.ev("cloud.sync.flush()");
      assert.equal(A.ev("cloud.sync.status().pending"), false);
      const raw = A.localStorage.getItem("fitkit_cloud_demo_state_v1");
      assert.ok(raw.includes("Phở bò") && raw.includes("2026-11-10"));
      assert.ok(!raw.includes("sk-BI-MAT-123"), "khoá API cá nhân không được lên cloud");
      for(const k of ["aiSettings", "driveSettings", "_firedKeys", "videoLibrary", "progressPhotos", "authDone"]) assert.ok(!(k in JSON.parse(Object.values(JSON.parse(raw))[0].json)), k + " là dữ liệu theo máy");
      // MÁY KHÁC (chưa có dữ liệu)
      const B = await t.app({ state: false }); copyServer(A, B);
      B.run(`state.aiSettings.openaiKey = "sk-CUA-MAY-B"`);
      await B.ev(`cloud.signIn("sync@x.vn", "matkhau1")`); await B.ev("cloud.consent.load()");
      const r = await B.ev("cloud.sync.syncNow()");
      assert.ok(["ok", "pushed"].includes(r), r);
      assert.equal(B.ev("state.onboarded"), true); assert.equal(B.ev("state.profile.weight"), 71.5);
      assert.equal(B.ev(`state.waterLog["2026-11-11"]`), 2.5); assert.equal(B.ev(`state.foodLog["2026-11-11"].breakfast[0].name`), "Phở bò");
      assert.deepEqual(B.evj(`state.workoutLog["2026-11-10"].completedExerciseIds`), ["x1"]);
      assert.equal(B.ev("state.aiSettings.openaiKey"), "sk-CUA-MAY-B", "khoá API của máy B giữ nguyên");
      assert.ok(JSON.parse(B.localStorage.getItem("fitkit_state_v1")).onboarded, "đã ghi xuống fitkit_state_v1 (không đổi key)");
      assert.equal(B.ev("cloud.sync.status().owner"), B.ev("cloud.user.uid"));
    });
    t.test("C · Hai máy cùng sửa → GỘP (không mất ngày nào); bên có updatedAt mới hơn thắng khi trùng khoá", async ()=>{
      const A = await t.app({ state: { onboarded:true, authDone:true } });
      await A.ev(`cloud.signUp("gop@x.vn", "matkhau1", "Gộp")`); await A.ev(`cloud.consent.record({ terms:true, age:true, health:true }, "s")`);
      await sleep(30); await A.ev("cloud.sync.syncNow()");
      const B = await t.app({ state: false }); copyServer(A, B);
      await B.ev(`cloud.signIn("gop@x.vn", "matkhau1")`); await B.ev("cloud.consent.load()"); await B.ev("cloud.sync.syncNow()");
      // A ngoại tuyến ghi ngày 12; B ghi ngày 13 + sửa cân nặng rồi đẩy trước
      A.setNow("2026-11-14T08:00"); A.run(`state.waterLog["2026-11-12"] = 1.8; state.profile.weight = 70; saveState();`);
      B.setNow("2026-11-14T09:00"); B.run(`state.waterLog["2026-11-13"] = 2.2; state.profile.weight = 69; state.inbodyLogs.push({ id:"ib1", ts:1, weight:69 }); saveState();`);
      await B.ev("cloud.sync.flush()");
      copyServer(B, A);                                  // "máy chủ" giờ có bản của B
      A.setNow("2026-11-14T09:30");
      assert.equal(await A.ev("cloud.sync.syncNow()"), "merged");
      assert.equal(A.ev(`state.waterLog["2026-11-12"]`), 1.8, "ngày A ghi lúc ngoại tuyến còn nguyên");
      assert.equal(A.ev(`state.waterLog["2026-11-13"]`), 2.2, "ngày của B được gộp vào");
      assert.equal(A.ev("state.profile.weight"), 69, "hồ sơ: bản mới hơn (B, 09:00) thắng bản A (08:00)");
      assert.equal(A.ev("state.inbodyLogs.length"), 1);
      copyServer(A, B); B.setNow("2026-11-14T09:40");
      assert.equal(await B.ev("cloud.sync.syncNow()"), "pulled");
      assert.equal(B.ev(`state.waterLog["2026-11-12"]`), 1.8);
      // hàm gộp thuần
      const m = A.evj(`cloud.sync.merge({ a:{ x:1 }, finishedDates:["2026-11-02","2026-11-01"], list:[{id:1,v:"cũ"}], n:1 }, { a:{ x:9, y:2 }, finishedDates:["2026-11-03","2026-11-01"], list:[{id:1,v:"mới"},{id:2}], n:2, onboarded:true }, 100, 200)`);
      assert.deepEqual(m.a, { x:9, y:2 }); assert.deepEqual(m.finishedDates, ["2026-11-01", "2026-11-02", "2026-11-03"]);
      assert.deepEqual(m.list, [{ id:1, v:"mới" }, { id:2 }]); assert.equal(m.n, 2); assert.equal(m.onboarded, true);
    });
    t.test("C · Máy đang có dữ liệu (khách / tài khoản khác) mà cloud đã có bản sao lưu → HỎI trước khi ghi đè; 'để sau' không đụng gì; 'dùng cloud' có bản tạm khôi phục được", async ()=>{
      const A = await t.app({ state: { onboarded:true, authDone:true, waterLog: { "2026-11-01": 3 } } });
      await A.ev(`cloud.signUp("hoi@x.vn", "matkhau1", "Hỏi")`); await A.ev(`cloud.consent.record({ terms:true, age:true, health:true }, "s")`);
      await sleep(30); await A.ev("cloud.sync.syncNow()");
      const C = await t.app({ state: { onboarded:true, authDone:true, waterLog: { "2026-11-05": 1.1 }, profile: { name:"Khách", weight: 80 } } }); copyServer(A, C);
      C.run(`globalThis.__ans = "later"; cloud.sync.attach({ getState: ()=> state, applyState: fkApplyCloudState, choose: info=>{ globalThis.__info = info; return globalThis.__ans; } });`);
      await C.ev(`cloud.signIn("hoi@x.vn", "matkhau1")`); await C.ev("cloud.consent.load()");
      assert.equal(await C.ev("cloud.sync.syncNow()"), "paused");
      assert.equal(C.evj("__info").kind, "guest"); assert.ok(C.evj("__info").remoteAt > 0);
      assert.equal(C.ev(`state.waterLog["2026-11-05"]`), 1.1, "'để sau' → dữ liệu máy nguyên vẹn");
      assert.equal(C.ev(`state.waterLog["2026-11-01"]`), undefined);
      assert.equal(C.ev("cloud.sync.status().state"), "paused");
      assert.ok(JSON.parse(C.localStorage.getItem("fitkit_cloud_demo_state_v1"))[C.ev("cloud.user.uid")].json.includes("2026-11-01"), "'để sau' → cloud cũng không bị ghi đè");
      C.run(`globalThis.__ans = "cloud"`);
      await C.ev("cloud.sync.resume()");
      assert.equal(C.ev(`state.waterLog["2026-11-01"]`), 3); assert.equal(C.ev(`state.waterLog["2026-11-05"]`), undefined);
      assert.equal(C.ev("cloud.sync.status().hasBackup"), true, "trước khi ghi đè phải lưu bản tạm");
      C.ev("cloud.sync.restoreBackup()");
      assert.equal(C.ev(`state.waterLog["2026-11-05"]`), 1.1, "khôi phục bản tạm"); assert.equal(C.ev("state.profile.weight"), 80);
      // đăng xuất KHÔNG xoá dữ liệu trên máy
      await C.ev("cloud.signOut()");
      assert.equal(JSON.parse(C.localStorage.getItem("fitkit_state_v1")).waterLog["2026-11-05"], 1.1);
      // giao diện hỏi (pt.js): có đủ 4 lựa chọn + đóng sheet = "để sau"
      const D = await t.app();
      const p = D.ev(`fkSyncChoose({ kind:"switch", remoteAt: 1731542400000 })`);
      const h = D.lastHtml("sheet-content");
      for(const k of ["merge", "cloud", "local", "later"]) assert.match(h, new RegExp(`data-sc="${k}"`));
      assert.match(h, /lưu một bản tạm/);
      D.run("closeSheet()");
      assert.equal(await p, "later");
    });
    t.test("C · Firestore: state lớn được cắt khúc ≤ 250 000 ký tự (dưới giới hạn 1 MiB/tài liệu), đọc lại đúng; bản ghi dở từ máy khác → 'sync/torn', không áp vào máy", async ()=>{
      const m = miniCloud(); await m.ev("cloud.init()");
      const big = "Ghi chú bữa ăn tiếng Việt có dấu — ".repeat(18000);            // ~630 000 ký tự
      m.ctx.__st = { onboarded: true, workoutLog: { "2026-11-10": { note: big } }, aiSettings: { openaiKey: "sk-x" } };
      m.ev(`cloud.sync.attach({ getState: ()=> globalThis.__st, applyState: s=>{ globalThis.__st = s; } });`);
      await m.ev(`cloud.consent.record({ terms:true, age:true, health:true }, "t")`);
      await sleep(30); await m.ev("cloud.sync.syncNow()");
      const meta = m.store.get("users/U1/appState/meta");
      assert.ok(meta.n >= 3, "phải tách ≥ 3 khúc, thực tế " + meta.n);
      assert.deepEqual(Object.keys(meta).sort(), ["app", "chars", "device", "n", "updatedAt", "v"]);
      for(let i = 0; i < meta.n; i++){ const c = m.store.get("users/U1/appState/c" + i); assert.ok(c.s.length <= 250000); assert.equal(c.g, meta.updatedAt); assert.deepEqual(Object.keys(c).sort(), ["g", "i", "s"]); }
      assert.ok(!m.store.has("users/U1/appState/c" + meta.n));
      const back = await m.ev(`cloud.sync._stores.firebase.read("U1")`);
      assert.equal(back.data.workoutLog["2026-11-10"].note.length, big.length); assert.ok(!("aiSettings" in back.data));
      assert.equal(m.store.get("users/U1/consents/" + [...m.store.keys()].find(k=> k.startsWith("users/U1/consents/")).split("/").pop()).version, m.ev("cloud.policyVersion"));
      // bản ngắn hơn → xoá khúc thừa
      m.ctx.__st = { onboarded: true, workoutLog: {} }; m.ev("cloud.sync.markDirty()"); await m.ev("cloud.sync.syncNow()");
      assert.equal(m.store.get("users/U1/appState/meta").n, 1); assert.ok(!m.store.has("users/U1/appState/c1"), "khúc thừa của bản cũ phải bị xoá");
      // máy khác đang ghi dở: meta thế hệ mới nhưng khúc còn thế hệ cũ
      const cur = m.store.get("users/U1/appState/meta");
      m.store.set("users/U1/appState/meta", Object.assign({}, cur, { updatedAt: cur.updatedAt + 5000, device: "may-khac" }));
      const before = JSON.stringify(m.ctx.__st);
      const e = await errOf(m.ev("cloud.sync.syncNow()"));
      assert.equal(e.code, "sync/torn"); assert.match(e.message, /đang được ghi dở/); assert.equal(JSON.stringify(m.ctx.__st), before);
      // quá lớn → lỗi rõ ràng, không ghi
      assert.equal((await errOf(m.ev(`cloud.sync._stores.firebase.write("U1", { updatedAt: 1, device: "d", json: "x".repeat(250000 * 40 + 1) })`))).code, "sync/too-big");
    });
    t.test("C · Rút đồng ý dữ liệu sức khoẻ → xoá bản sao lưu trên cloud, dữ liệu máy giữ nguyên; xoá tài khoản xoá cả bản cloud + nhật ký đồng ý", async ()=>{
      const A = await t.app({ state: { onboarded:true, authDone:true, waterLog: { "2026-11-02": 2 } } });
      await A.ev(`cloud.signUp("rut@x.vn", "matkhau1", "Rút")`); await A.ev(`cloud.consent.record({ terms:true, age:true, health:true }, "s")`);
      await sleep(30); await A.ev("cloud.sync.syncNow()");
      const uid = A.ev("cloud.user.uid");
      assert.ok(JSON.parse(A.localStorage.getItem("fitkit_cloud_demo_state_v1"))[uid]);
      await A.ev("cloud.sync.purgeCloud()"); await A.ev(`cloud.consent.record({ health:false }, "settings")`);
      assert.equal(JSON.parse(A.localStorage.getItem("fitkit_cloud_demo_state_v1"))[uid], undefined);
      assert.equal(A.ev("cloud.sync.status().state"), "no-consent");
      A.run(`state.waterLog["2026-11-03"] = 1; saveState();`);
      assert.equal(JSON.parse(A.localStorage.getItem("fitkit_cloud_demo_state_v1"))[uid], undefined, "đã rút đồng ý → không đẩy nữa");
      assert.equal(A.ev(`state.waterLog["2026-11-02"]`), 2);
      await A.ev(`cloud.consent.record({ health:true }, "settings")`); await sleep(30); await A.ev("cloud.sync.syncNow()");
      assert.ok(JSON.parse(A.localStorage.getItem("fitkit_cloud_demo_state_v1"))[uid]);
      await A.ev(`cloud.deleteAccount("matkhau1")`);
      const db = JSON.parse(A.localStorage.getItem("fitkit_cloud_demo_v1"));
      assert.equal(JSON.parse(A.localStorage.getItem("fitkit_cloud_demo_state_v1"))[uid], undefined, "xoá tài khoản → xoá bản sao lưu");
      assert.equal((db.consents || {})[uid], undefined); assert.equal(db.users[uid], undefined);
      assert.equal(A.evj("cloud.consent.log('" + uid + "')").length, 0);
      assert.equal(A.ev(`state.waterLog["2026-11-02"]`), 2, "dữ liệu trên máy không bị xoá khi xoá tài khoản (trừ khi người dùng tích chọn)");
      assert.equal(A.ev("cloud.sync.status().owner"), null);
      // Firebase, chưa deploy Functions (gói Spark): đường dự phòng tự xoá appState + consents
      assert.match(cloudJs, /await fbStateStore\.purge\(u\.uid\)/); assert.match(cloudJs, /for\(const sub of \["consents", "private"\]\)/);
      assert.match(ptJs, /id="del-local"/, "sheet xoá tài khoản có lựa chọn xoá cả dữ liệu trên máy");
    });

    /* ================= XUẤT DỮ LIỆU ================= */
    t.test("E · Xuất dữ liệu của tôi (JSON): đủ tài khoản / hồ sơ / đồng ý / state / form PT; che khoá API; không lộ kho demo (tài khoản khác)", async ()=>{
      const app = await t.app({ state: { onboarded:true, authDone:true, waterLog: { "2026-11-02": 2 } } });
      await app.ev(`cloud.signUp("nguoikhac@x.vn", "matkhau-nguoi-khac", "Người khác")`); await app.ev("cloud.signOut()");
      await app.ev(`cloud.signUp("xuat@x.vn", "matkhau1", "Xuất")`); await app.ev(`cloud.consent.record({ terms:true, age:true, health:false }, "signup")`);
      await app.ev(`cloud.updateMyProfile({ isPT:true })`);
      const c = await app.ev(`cloud.createClient({ name:"HV Một", goal:"Giảm mỡ" })`);
      await app.ev(`cloud.saveSession("${c.id}", { date:"2026-11-20", time:"18:00", title:"Buổi 1" })`);
      app.run(`state.aiSettings.openaiKey = "sk-KHOA-RIENG"; localStorage.setItem("fitkit_np_plans_v1", JSON.stringify({ a: 1 }));`);
      const out = clone(await app.ev("cloud.exportMyData()"));
      assert.equal(out.format, "tapeasy-export-v1"); assert.equal(out.account.email, "xuat@x.vn"); assert.deepEqual(out.account.providers, ["password"]);
      assert.equal(out.consents.length, 3); assert.equal(out.device.state.waterLog["2026-11-02"], 2);
      assert.equal(out.device.state.aiSettings.openaiKey, "***"); assert.deepEqual(out.device.other.fitkit_np_plans_v1, { a: 1 });
      assert.equal(out.cloud.clients.length, 1); assert.equal(out.cloud.clients[0].sessions[0].title, "Buổi 1");
      const s = JSON.stringify(out);
      assert.ok(!s.includes("sk-KHOA-RIENG")); assert.ok(!s.includes("nguoikhac@x.vn"), "không được xuất dữ liệu của tài khoản khác");
      assert.ok(!Object.keys(out.device.other).some(k=> /demo/.test(k)));
      await app.ev("cloud.signOut()");
      const guest = clone(await app.ev("cloud.exportMyData()"));
      assert.equal(guest.account, null); assert.ok(guest.device.state.onboarded, "khách (không tài khoản) vẫn xuất được dữ liệu trên máy");
      assert.match(ptJs, /async function fkExportMyData\(\)/); assert.match(ptJs, /a\.download = name/);
    });

    /* ================= CLOUD FUNCTIONS: OTP EMAIL ================= */
    t.test("A3 · Function requestEmailOtp/verifyEmailOtp: chỉ lưu BĂM, hạn 10 phút, ≤ 5 lần thử, 60 s/lần, trả lời trung tính, khoá lấy từ biến môi trường", async ()=>{
      const src = read("functions/account.js");
      assert.match(src, /defineSecret\("MAIL_API_KEY"\)/); assert.match(src, /defineSecret\("OTP_PEPPER"\)/);
      assert.ok(!/(re_|SG\.|xkeysib-)[A-Za-z0-9_-]{16,}/.test(src), "không hard-code khoá dịch vụ mail");
      assert.match(read("functions/index.js"), /require\("\.\/account"\)/);
      const env = { MAIL_API_KEY: "test-mail-key", OTP_PEPPER: "pepper-test", MAIL_PROVIDER: "resend", MAIL_FROM: "TapEasy <no-reply@example.test>" };
      const F = loadAccountFns(env);
      assert.equal(F.T.OTP_TTL_MS, 600000); assert.equal(F.T.OTP_MAX_TRIES, 5); assert.equal(F.T.OTP_RESEND_MS, 60000);
      F.users.set("u1", { uid: "u1", email: "co@x.vn" });
      let now = 1_800_000_000_000; const deps = { now: ()=> now, genCode: ()=> "482913", fetch: F.fetchFake };
      const req = (data, ip)=> ({ data, rawRequest: { ip: ip || "1.2.3.4" } });
      // email không có tài khoản → ok trung tính, KHÔNG gửi mail
      assert.deepEqual(await F.T.requestEmailOtpCore(req({ email: "khongco@x.vn" }), deps), { ok: true });
      assert.equal(F.calls.mail.length, 0);
      // email có tài khoản → gửi mail chứa mã; Firestore chỉ có băm
      assert.deepEqual(await F.T.requestEmailOtpCore(req({ email: " CO@x.vn " }), deps), { ok: true });
      assert.equal(F.calls.mail.length, 1); assert.equal(F.calls.mail[0].url, "https://api.resend.com/emails");
      assert.equal(F.calls.mail[0].headers.Authorization, "Bearer test-mail-key"); assert.ok(F.calls.mail[0].body.text.includes("482913"));
      const dump = JSON.stringify([...F.store.entries()]);
      assert.ok(!dump.includes("482913"), "mã gốc không được lưu"); assert.ok(!dump.includes("co@x.vn"), "email không lưu dạng rõ (id = băm)");
      const rec = [...F.store.entries()].find(([k, v])=> k.startsWith("email_otps/") && v.hash)[1];
      assert.equal(rec.exp, now + 600000); assert.equal(rec.tries, 0); assert.match(rec.hash, /^[0-9a-f]{64}$/);
      // gửi lại trong 60 s → chặn
      assert.equal((await errOf(F.T.requestEmailOtpCore(req({ email: "co@x.vn" }), deps))).code, "resource-exhausted");
      // sai mã 4 lần → invalid-argument; lần 5 → khoá; mã đúng sau đó cũng không dùng được
      const v = (code, pw)=> F.T.verifyEmailOtpCore(req({ email: "co@x.vn", code, newPassword: pw || "matkhaumoi" }), deps);
      assert.equal((await errOf(v("482913", "123"))).code, "invalid-argument");
      for(let i = 0; i < 4; i++) assert.equal((await errOf(v("000000"))).code, "invalid-argument");
      const fifth = await errOf(v("000000")); assert.equal(fifth.code, "resource-exhausted"); assert.match(fifth.message, /quá 5 lần/);
      assert.equal((await errOf(v("482913"))).message, "Mã không đúng hoặc đã hết hạn.");
      assert.equal(F.calls.updateUser.length, 0);
      // mã mới → hết hạn sau 10 phút
      now += 61000; await F.T.requestEmailOtpCore(req({ email: "co@x.vn" }), deps);
      now += 600001; assert.equal((await errOf(v("482913"))).message, "Mã không đúng hoặc đã hết hạn.");
      // mã mới → đúng → đặt mật khẩu + thu hồi phiên; dùng lại mã → từ chối
      await F.T.requestEmailOtpCore(req({ email: "co@x.vn" }), deps);
      assert.deepEqual(await v("482913"), { ok: true });
      assert.deepEqual(F.calls.updateUser, [{ uid: "u1", patch: { password: "matkhaumoi", emailVerified: true } }]); assert.deepEqual(F.calls.revoke, ["u1"]);
      assert.equal((await errOf(v("482913"))).code, "invalid-argument", "mã chỉ dùng 1 lần");
      // quá 5 lần / giờ / email
      const F2 = loadAccountFns(env); F2.users.set("u2", { uid: "u2", email: "nhieu@x.vn" });
      let n2 = 1_800_000_000_000; const d2 = { now: ()=> n2, genCode: ()=> "111111", fetch: F2.fetchFake };
      for(let i = 0; i < 5; i++){ await F2.T.requestEmailOtpCore(req({ email: "nhieu@x.vn" }, "9.9.9." + i), d2); n2 += 61000; }
      assert.match((await errOf(F2.T.requestEmailOtpCore(req({ email: "nhieu@x.vn" }, "9.9.9.9"), d2))).message, /quá nhiều mã/);
      // giới hạn theo IP
      const F3 = loadAccountFns(env); let n3 = 1_800_000_000_000; const d3 = { now: ()=> n3, fetch: F3.fetchFake };
      for(let i = 0; i < 20; i++) await F3.T.requestEmailOtpCore(req({ email: `a${i}@x.vn` }, "5.5.5.5"), d3);
      assert.equal((await errOf(F3.T.requestEmailOtpCore(req({ email: "a99@x.vn" }, "5.5.5.5"), d3))).code, "resource-exhausted");
      // chưa cấu hình mail → failed-precondition TRƯỚC khi tra tài khoản (không lộ email)
      const F4 = loadAccountFns({ OTP_PEPPER: "p" }); F4.users.set("u1", { uid: "u1", email: "co@x.vn" });
      assert.equal((await errOf(F4.T.requestEmailOtpCore(req({ email: "co@x.vn" }), {}))).code, "failed-precondition");
      assert.equal((await errOf(F4.T.requestEmailOtpCore(req({ email: "khongco@x.vn" }), {}))).code, "failed-precondition");
      // dịch vụ mail lỗi → vẫn trả trung tính, huỷ mã
      const F5 = loadAccountFns(Object.assign({ __mailFails: true }, env)); F5.users.set("u1", { uid: "u1", email: "co@x.vn" });
      assert.deepEqual(await F5.T.requestEmailOtpCore(req({ email: "co@x.vn" }), { fetch: F5.fetchFake, genCode: ()=> "123123" }), { ok: true });
      assert.ok(![...F5.store.values()].some(x=> x.hash), "gửi mail lỗi → không để lại mã còn hiệu lực");
    });
    t.test("E · Function exportMyData: cần đăng nhập, chỉ trả dữ liệu của CHÍNH người gọi, giới hạn 5 lần/ngày", async ()=>{
      const F = loadAccountFns({});
      F.store.set("users/me", { name: "Tôi" }); F.store.set("users/kia", { name: "Người kia" });
      F.store.set("routines/r1", { authorUid: "me", title: "Của tôi" }); F.store.set("routines/r2", { authorUid: "kia", title: "Của người kia" });
      F.store.set("orders/o1", { uid: "kia", total: 5 }); F.store.set("events/e1/regs/me", { uid: "me", phone: "09" }); F.store.set("events/e1/regs/kia", { uid: "kia", phone: "08" });
      assert.equal((await errOf(F.T.exportMyDataCore({ data: {} }))).code, "unauthenticated");
      const out = await F.T.exportMyDataCore({ auth: { uid: "me" }, data: {} });
      assert.equal(out.data.user.name, "Tôi"); assert.equal(out.data.routines.length, 1); assert.equal(out.data.orders.length, 0); assert.equal(out.data.regs.length, 1);
      assert.ok(!JSON.stringify(out).includes("Người kia") && !JSON.stringify(out).includes("Của người kia"));
      for(let i = 0; i < 4; i++) await F.T.exportMyDataCore({ auth: { uid: "me" }, data: {} });
      assert.equal((await errOf(F.T.exportMyDataCore({ auth: { uid: "me" }, data: {} }))).code, "resource-exhausted");
    });

    /* ================= RULES ================= */
    t.test("(f) firestore.rules: appState & consents CHỈ chủ tài khoản; kiểm kiểu + kích thước khúc; nhật ký đồng ý chỉ-thêm, giờ máy chủ; kho OTP đóng kín", ()=>{
      const blk = name=>{ const i = rules.indexOf("match /users/{uid}/" + name); assert.ok(i > 0, "thiếu match " + name); return rules.slice(i, rules.indexOf("\n    }\n", i) + 6); };
      const a = blk("appState/{doc}");
      assert.match(a, /allow get, list, delete: if signedIn\(\) && me\(\) == uid;/);
      assert.match(a, /allow create, update: if signedIn\(\) && me\(\) == uid && \(/);
      assert.ok(!/hasPerm|isStaff|resource\.data\.isPT/.test(a), "không quản trị viên / PT nào được đọc dữ liệu sức khoẻ của người khác");
      assert.match(a, /s is string && request\.resource\.data\.s\.size\(\) <= 262144/); assert.match(a, /keys\(\)\.hasOnly\(\['i', 'g', 's'\]\)/);
      assert.match(a, /n is int && request\.resource\.data\.n >= 1 && request\.resource\.data\.n <= 40/); assert.match(a, /updatedAt is number/);
      assert.ok(262144 * 3 < 1048576 - 1024, "khúc 262 144 ký tự × 3 byte UTF-8 vẫn dưới 1 MiB");
      assert.ok(app0Limits.CHUNK <= 262144 && app0Limits.MAX_CHUNKS <= 40, "giới hạn client phải ≤ giới hạn rules");
      const c = blk("consents/{cid}");
      assert.match(c, /allow update: if false;/); assert.match(c, /type in \['terms', 'health', 'age'\]/); assert.match(c, /granted is bool/);
      assert.match(c, /request\.resource\.data\.at == request\.time/); assert.match(c, /allow get, list: if signedIn\(\) && me\(\) == uid;/);
      assert.match(rules, /match \/email_otps\/\{id\} \{ allow read, write: if false; \}/); assert.match(rules, /match \/otp_rate\/\{id\} \{ allow read, write: if false; \}/);
      assert.match(rules, /match \/users\/\{uid\} \{\s*allow get: if signedIn\(\) && \(me\(\) == uid \|\| resource\.data\.isPT == true\);\s*allow list: if false;/, "vẫn cấm liệt kê users");
      // tài liệu client ghi đúng bộ khoá rules cho phép
      assert.match(cloudJs, /\{ v: 1, updatedAt: rec\.updatedAt, device: String\(rec\.device \|\| ""\)\.slice\(0, 64\), n, chars: json\.length, app: "tapeasy" \}/);
      assert.match(cloudJs, /const doc = \{ type: r\.type, granted: !!r\.granted, version: String\(r\.version\), clientAt: Number\(r\.at\), src: String\(r\.src \|\| "app"\)\.slice\(0, 24\),\s*platform: isNative\(\) \? "native" : "web", at: firebase\.firestore\.FieldValue\.serverTimestamp\(\) \}/);
      // dọn khi xoá tài khoản (máy chủ)
      assert.match(read("functions/index.js"), /email_otps/);
    });

    /* ================= RULES — chạy thật trên bộ thông dịch rules mini của QA (nếu có trên máy) ================= */
    const ENGINE = path.resolve(ROOT, "..", "_test", "qa-security", "rules-engine.js");
    if(fs.existsSync(ENGINE)){
      t.test("R3-CLOUD-06 + (f) rules chạy thật: appState/consents chỉ chủ tài khoản (nhân sự cũng không), khúc > 262 144 ký tự / id lạ / thừa khoá bị từ chối, đồng ý không ghi lùi ngày, hồ sơ users kiểm kiểu & độ dài", ()=>{
      const { Engine, TS } = require(ENGINE);
      const eng = new Engine(path.join(ROOT, "firestore.rules"));
      const NOW = 1_800_000_000_000;
      const me = { uid:"me", token:{} }, other = { uid:"other", token:{} }, staff = { uid:"st", token:{ role:"owner", px:[], auth_time: NOW/1000 } };
      const db = { "roles/st": { role:"owner" }, "users/me": { uid:"me", name:"Tôi", isPT:true } };
      const meta = { v:1, updatedAt: NOW, device:"d1", n:1, chars:100, app:"tapeasy" };
      const bad = [];
            const T = (label, req, want)=>{ let r; try{ r = eng.allow(Object.assign({ db, time: NOW }, req)); }catch(e){ r = { ok:false, crash:e.message }; } if(r.ok !== want) bad.push(`${label}: muốn ${want ? "cho phép" : "từ chối"} — ${JSON.stringify(r).slice(0, 160)}`); };
      T("owner create meta", { op:"create", path:"users/me/appState/meta", auth:me, data:meta }, true);
      T("owner get meta", { op:"get", path:"users/me/appState/meta", auth:me, db:Object.assign({"users/me/appState/meta":meta}, db) }, true);
      T("other get meta", { op:"get", path:"users/me/appState/meta", auth:other, db:Object.assign({"users/me/appState/meta":meta}, db) }, false);
      T("staff get meta", { op:"get", path:"users/me/appState/meta", auth:staff, db:Object.assign({"users/me/appState/meta":meta}, db) }, false);
      T("anon get", { op:"get", path:"users/me/appState/meta", auth:null }, false);
      T("other write", { op:"create", path:"users/me/appState/meta", auth:other, data:meta }, false);
      T("meta extra key", { op:"create", path:"users/me/appState/meta", auth:me, data:Object.assign({ x:1 }, meta) }, false);
      T("meta n=41", { op:"create", path:"users/me/appState/meta", auth:me, data:Object.assign({}, meta, { n:41 }) }, false);
      T("chunk ok", { op:"create", path:"users/me/appState/c0", auth:me, data:{ i:0, g:NOW, s:"x".repeat(250000) } }, true);
      T("chunk c39 ok", { op:"create", path:"users/me/appState/c39", auth:me, data:{ i:39, g:NOW, s:"{}" } }, true);
      T("chunk too big", { op:"create", path:"users/me/appState/c0", auth:me, data:{ i:0, g:NOW, s:"x".repeat(262145) } }, false);
      T("chunk c40", { op:"create", path:"users/me/appState/c40", auth:me, data:{ i:0, g:NOW, s:"x" } }, false);
      T("chunk weird id", { op:"create", path:"users/me/appState/evil", auth:me, data:{ i:0, g:NOW, s:"x" } }, false);
      T("chunk s not string", { op:"create", path:"users/me/appState/c1", auth:me, data:{ i:1, g:NOW, s:{ a:1 } } }, false);
      T("owner delete chunk", { op:"delete", path:"users/me/appState/c0", auth:me, db:Object.assign({"users/me/appState/c0":{i:0,g:1,s:"x"}}, db) }, true);
      const cs = { type:"health", granted:true, version:"2026-11-14", clientAt: NOW, src:"signup", platform:"web", at: TS(NOW) };
      T("consent create", { op:"create", path:"users/me/consents/c1", auth:me, data:cs }, true);
      T("consent backdated", { op:"create", path:"users/me/consents/c1", auth:me, data:Object.assign({}, cs, { at: TS(NOW - 86400000) }) }, false);
      T("consent bad type", { op:"create", path:"users/me/consents/c1", auth:me, data:Object.assign({}, cs, { type:"marketing" }) }, false);
      T("consent update", { op:"update", path:"users/me/consents/c1", auth:me, data:Object.assign({}, cs, { granted:false }), db:Object.assign({"users/me/consents/c1":cs}, db) }, false);
      T("consent other read", { op:"get", path:"users/me/consents/c1", auth:other, db:Object.assign({"users/me/consents/c1":cs}, db) }, false);
      T("consent staff list", { op:"list", path:"users/me/consents/c1", auth:staff, db:Object.assign({"users/me/consents/c1":cs}, db) }, false);
      T("otp read", { op:"get", path:"email_otps/abc", auth:staff, db:Object.assign({"email_otps/abc":{hash:"x"}}, db) }, false);
      T("otp write", { op:"create", path:"email_otps/abc", auth:me, data:{ hash:"x" } }, false);
      T("user create ok", { op:"create", path:"users/new", auth:{uid:"new",token:{}}, data:{ uid:"new", name:"A", isPT:false, mainRole:null, createdAt: NOW } }, true);
      T("user name too long", { op:"create", path:"users/new", auth:{uid:"new",token:{}}, data:{ uid:"new", name:"A".repeat(121), isPT:false } }, false);
      T("user name not string", { op:"update", path:"users/me", auth:me, data:{ uid:"me", name:{ html:"<b>" }, isPT:true } }, false);
      T("user update ok", { op:"update", path:"users/me", auth:me, data:{ uid:"me", name:"Tôi mới", isPT:true, mainRole:"pt" } }, true);
      expectNone(bad, "firestore.rules sai kỳ vọng");
      });
    } else {
      t.test("R3-CLOUD-06 (rules — bỏ qua chạy thật: không có _test/qa-security/rules-engine.js trên máy này)", ()=>{ t.info("Bỏ qua", ["Kiểm tĩnh ở test '(f) firestore.rules' bên trên"]); });
    }
    t.test("R3-CLOUD-06 (tĩnh): users/{uid} create/update phải qua okUserDoc() — tên ≤ 120 ký tự, isPT là bool, ≤ 60 trường", ()=>{
      assert.match(rules, /function okUserDoc\(\) \{[\s\S]*?size\(\) <= 60[\s\S]*?'name', ''\)\.size\(\) <= 120[\s\S]*?'isPT', false\) is bool/);
      assert.match(rules, /allow create: if signedIn\(\) && me\(\) == uid && okUserDoc\(\)/); assert.match(rules, /allow update: if \(signedIn\(\) && me\(\) == uid && okUserDoc\(\)/);
    });
    t.test("R3-CLOUD-10: khối 'đã chặn' trên hồ sơ PT không gắn chồng trình nghe fk:blocks-changed qua mỗi lần vẽ", async ()=>{
      const app = await t.app();
      // DOM giả không gỡ trình nghe thật → đếm số lần gắn trừ số lần gỡ
      app.run(`(()=>{ const d = document; globalThis.__net = 0; const a = d.addEventListener.bind(d), r = d.removeEventListener.bind(d);
        d.addEventListener = (t, f)=>{ if(t === "fk:blocks-changed") globalThis.__net++; return a(t, f); };
        d.removeEventListener = (t, f)=>{ if(t === "fk:blocks-changed") globalThis.__net--; return r(t, f); }; })()`);
      for(let i = 0; i < 5; i++) app.run(`ppBlockedView("u-bi-chan", "Người bị chặn", ()=>{}, ()=>{})`);
      assert.equal(app.ev("__net"), 1, "5 lần vẽ chỉ được để lại 1 trình nghe");
    });

    /* ================= PHÁP LÝ / TÀI LIỆU ================= */
    t.test("D/E · privacy-policy.html & terms.html song ngữ, đủ mục bắt buộc; docs/LEGAL-VN.md & DATABASE-SETUP.md đủ đề mục; phiên bản chính sách khớp mã", ()=>{
      for(const f of ["privacy-policy.html", "terms.html", "docs/LEGAL-VN.md", "docs/DATABASE-SETUP.md", "docs/qa/R3-cloud.md"]) assert.ok(exists(f), "thiếu file " + f);
      const ver = /POLICY_VERSION = "([^"]+)"/.exec(cloudJs)[1];
      const pp = read("privacy-policy.html"), tm = read("terms.html");
      for(const [f, s] of [["privacy-policy.html", pp], ["terms.html", tm]]){ assert.ok(s.includes(ver), f + " phải ghi phiên bản " + ver); assert.match(s, /lang="en"/, f + " phải có phần tiếng Anh"); assert.ok(!/<script[^>]+src="https?:/.test(s), f + " không nạp script ngoài"); }
      expectNone(["dữ liệu nhạy cảm", "sức khoẻ", "Google", "Firebase", "asia-southeast1", "chuyển dữ liệu ra nước ngoài", "rút lại sự đồng ý", "Xuất dữ liệu của tôi", "Xoá tài khoản", "16 tuổi", "Thời hạn lưu", "Mục đích",
        "sensitive personal data", "cross-border", "withdraw", "retention"].filter(k=> !pp.toLowerCase().includes(k.toLowerCase())), "privacy-policy.html thiếu nội dung");
      expectNone(["không thay thế", "y khoa", "Quy tắc cộng đồng", "Nội dung bị cấm", "24 giờ", "Gian hàng", "không giữ tiền", "thực phẩm bảo vệ sức khoẻ", "16 tuổi",
        "not medical advice", "Community rules", "Prohibited content", "Marketplace", "Personal trainers"].filter(k=> !tm.toLowerCase().includes(k.toLowerCase())), "terms.html thiếu nội dung");
      const legal = read("docs/LEGAL-VN.md");
      expectNone(["không thay thế tư vấn", "Luật Bảo vệ dữ liệu cá nhân", "13/2023", "An ninh mạng", "53/2022", "147/2024", "52/2013", "85/2021", "Bảo vệ quyền lợi người tiêu dùng", "thực phẩm chức năng",
        "đánh giá tác động", "chuyển dữ liệu", "16 tuổi", "24 giờ", "Rủi ro", "Cao", "Thuế", "kiểm tra lại"].filter(k=> !legal.includes(k)), "docs/LEGAL-VN.md thiếu mục");
      const setup = read("docs/DATABASE-SETUP.md");
      expectNone(["asia-southeast1", "vn.thangvu.fitkit", "SHA-1", "SHA-256", "google-services.json", "GoogleService-Info.plist", "firebase deploy --only firestore:rules", "firestore:indexes", "--only functions",
        "thangvu030198-ai.github.io", "App Check", "Spark", "Blaze", "phoneOtp", "emailOtp", "MAIL_API_KEY", "OTP_PEPPER", "Sao lưu", "Facebook", "Apple", "firebase-config.js"].filter(k=> !setup.includes(k)), "docs/DATABASE-SETUP.md thiếu mục");
      assert.match(ptJs, /fkLegalUrl\("terms\.html"\)/); assert.match(ptJs, /fkLegalUrl\("privacy-policy\.html"\)/);
    });
  },
};
/* giới hạn khúc phía client (đọc tĩnh từ cloud.js) — so với rules */
const app0Limits = (()=>{ const s = read("cloud.js"); const m = /const CHUNK = (\d+), MAX_CHUNKS = (\d+)/.exec(s); return { CHUNK: Number(m[1]), MAX_CHUNKS: Number(m[2]) }; })();

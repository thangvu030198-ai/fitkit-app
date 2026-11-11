/* =========================================================================
   Vòng sửa lỗi QA (11–12/11/2026) — INTEGRATOR (cuối vòng 2)
   Hồi quy cho các mục "Chuyển giao" vòng 2 còn mở trong docs/qa/FIX-*.md (mã I-xx — xem docs/qa/FIX-integrator.md).
   Chạy riêng: node tests/run.js --only 67-fix
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");

const NOW = Date.parse("2026-11-11T09:00:00");
const PROF = o=> Object.assign({ name:"Tester", gender:"female", age:24, height:160, weight:55, activity:"light", goal:"lose", autoTargets:true }, o || {});
const HS = o=> Object.assign({ v:1, completedAt: NOW - 86400000, parq:{}, pregnancy:"none", diabetes:"none", cardio:"none", kidney:"none", edHistory:"no", injuries:[] }, o || {});
const txt = h=> String(h || "").replace(/<[^>]+>/g, " ");

/* ---- Firebase giả cho cloud-events.js (chỉ phần dùng tới) + mô phỏng rules vòng 2 của mreports / reviews ---- */
const FAKE_FB = `(()=>{
  const S = globalThis.__fs = { docs:{}, log:[], calls:[], fns:{} };
  const perm = ()=> Object.assign(new Error("Missing or insufficient permissions."), { code:"permission-denied" });
  const INC = n=> ({ __inc:n });
  const snap = p=> ({ exists: p in S.docs, id: p.split("/").pop(), data: ()=> S.docs[p] ? JSON.parse(JSON.stringify(S.docs[p])) : undefined, ref: doc(p) });
  function doc(p){ return { path:p, id:p.split("/").pop(), collection: n=> col(p + "/" + n), get: async ()=> snap(p),
    set: async d=>{ S.docs[p] = d; }, update: async d=>{ S.docs[p] = Object.assign({}, S.docs[p], d); }, delete: async ()=>{ delete S.docs[p]; } }; }
  function col(p){ return { path:p, doc: id=> doc(p + "/" + (id || Math.random().toString(36).slice(2))) }; }
  const ME = ()=> globalThis.cloud.user.uid;
  /* rules (rút gọn đúng ý firestore.rules vòng 2): mreports chỉ kiểm duyệt đọc; tạo mới { uid, reason, ts } (không w/sw), không ghi đè;
     bài: chỉ reportCount (+1) + reported, kèm mreports của mình được tạo trong cùng lần ghi */
  function allowed(w, writes){
    const [op, p, d] = w;
    if(/\\/mreports\\//.test(p)){
      if(op !== "set" || (p in S.docs)) return false;
      const ks = Object.keys(d || {}); return ks.every(k=> ["uid","reason","ts"].includes(k)) && d.uid === ME() && p.endsWith("/" + ME());
    }
    if(/^events\\/[^/]+\\/reviews\\/[^/]+$/.test(p) && op === "update"){
      const ks = Object.keys(d || {});
      return ks.every(k=> ["reportCount","reported"].includes(k)) && d.reportCount && d.reportCount.__inc === 1
        && writes.some(x=> x[0] === "set" && x[1] === p + "/mreports/" + ME());
    }
    return false;
  }
  const fsApi = { collection: n=> col(n),
    runTransaction: async fn=>{ const writes = [];
      const t = { get: async r=>{ S.log.push(["get", r.path]); if(/\\/mreports\\//.test(r.path)) throw perm(); return snap(r.path); },
        set: (r, d)=>{ writes.push(["set", r.path, d]); }, update: (r, d)=>{ writes.push(["update", r.path, d]); }, delete: r=>{ writes.push(["delete", r.path]); } };
      const res = await fn(t);
      if(!writes.every(w=> allowed(w, writes))) throw perm();
      writes.forEach(w=>{ S.log.push(w.slice(0, 3));
        if(w[0] === "set") S.docs[w[1]] = JSON.parse(JSON.stringify(w[2]));
        else if(w[0] === "update"){ const o = Object.assign({}, S.docs[w[1]]); for(const k in w[2]){ const v = w[2][k]; o[k] = v && v.__inc != null ? (Number(o[k]) || 0) + v.__inc : v; } S.docs[w[1]] = o; }
        else delete S.docs[w[1]]; });
      return res; } };
  const firestore = ()=> fsApi; firestore.FieldValue = { increment: INC, delete: ()=> ({ __del:1 }), arrayUnion: (...a)=> ({ __union:a }) };
  globalThis.firebase = { apps:[{}], firestore, SDK_VERSION:"10.12.2",
    app: ()=> ({ functions: ()=> ({ httpsCallable: name=> async data=>{ S.calls.push([name, data]); const f = S.fns[name];
      if(!f){ const e = new Error("NOT_FOUND"); e.code = "functions/not-found"; throw e; } return { data: await f(data) }; } }) }) };
  globalThis.cloud = { mode:"firebase", user:{ uid:"me", name:"QA", email:"qa@tapeasy.vn" }, profile:{ createdAt: Date.now() - 30 * 864e5 }, init: async ()=>{} };
  globalThis.state = { profile:{ name:"QA" } };
})()`;

module.exports = {
  name: "Vòng sửa lỗi QA — Integrator (chuyển giao vòng 2)",
  area: "cloud-events / events / shop / cloud-social / pt.js / app.js / ui-signature / freevideos / video / achievements / training-pro / pt-connect",
  async define(t){

    /* ---------------- I-01 · báo cáo Khoảnh khắc (Firebase) ---------------- */
    t.test("I-01 (FIX-security vòng 2 #1): Firebase report — mreports chỉ { uid, reason, ts }, bài chỉ reportCount +1 / reported (không w/reportWeight), KHÔNG đọc mreports; báo cáo lần 2 → 'đã báo cáo'", async ()=>{
      const app = await t.app({ scripts:["cloud-events.js"], state:false, settleMs:5 });
      app.run(FAKE_FB);
      assert.equal(await app.ev("cloudEvents.init()"), "firebase");
      app.run(`__fs.docs["events/e1/reviews/r1"] = { uid:"author", kind:"review", text:"x".repeat(30), reportCount:1, reportWeight:1, media:[{}] };
               __fs.docs["events/e1/reviews/r2"] = { uid:"me", kind:"review", text:"x".repeat(30), media:[{}] };`);
      const r1 = await app.ev(`cloudEvents.report("e1", "r1", "Spam, quảng cáo")`);
      const res = JSON.parse(JSON.stringify(r1));
      assert.equal(res.already, false, "lần đầu phải ghi được (rules cho phép)");
      assert.equal(res.reportCount, 2);
      const doc = app.evj(`__fs.docs["events/e1/reviews/r1"]`), mr = app.evj(`__fs.docs["events/e1/reviews/r1/mreports/me"]`);
      assert.deepEqual(Object.keys(mr).sort(), ["reason", "ts", "uid"], "mreports có trường lạ: " + Object.keys(mr));
      assert.equal(doc.reportCount, 2); assert.equal(doc.reportWeight, 1, "client không được tự cộng reportWeight");
      assert.ok(!app.evj(`__fs.log`).some(x=> x[0] === "get" && /mreports/.test(x[1])), "không được đọc mreports (chỉ kiểm duyệt đọc được)");
      const again = JSON.parse(JSON.stringify(await app.ev(`cloudEvents.report("e1", "r1", "Spam")`)));
      assert.equal(again.already, true, "báo cáo lần 2 phải báo 'đã báo cáo'");
      assert.equal(app.evj(`__fs.docs["events/e1/reviews/r1"]`).reportCount, 2, "báo cáo lần 2 không được cộng");
      let err = null; try{ await app.ev(`cloudEvents.report("e1", "r2", "x")`); }catch(e){ err = e; }
      assert.ok(err && /bài của bạn/.test(err.message), "tự báo cáo bài mình phải bị chặn");
      const src = read("cloud-events.js"), fire = src.slice(src.indexOf("const fire = {"));
      const body = fire.slice(fire.indexOf("async report("), fire.indexOf("async moderate("));
      assert.ok(!/\bw\s*\}|reportWeight:\s*firebase/.test(body), "nhánh Firebase còn ghi w / reportWeight");
    }, { bug:"FIX-security#1", severity:"Cao" });

    /* ---------------- I-02 · voucher hoàn thành từ máy chủ ---------------- */
    t.test("I-02a: cloud-events — claimChallengeVoucher / myVouchers gọi callable (Firebase); Function chưa có → pending / null; demo → null / []", async ()=>{
      const app = await t.app({ scripts:["cloud-events.js"], state:false, settleMs:5 });
      app.run(FAKE_FB); await app.ev("cloudEvents.init()");
      assert.deepEqual(JSON.parse(JSON.stringify(await app.ev(`cloudEvents.claimChallengeVoucher("ch1")`))), { ok:false, pending:true });
      assert.equal(await app.ev(`cloudEvents.myVouchers()`), null);
      app.run(`__fs.fns.claimChallengeVoucher = d=> ({ ok:true, already:false, voucher:{ code:"TE-AB12CD34", kind:"pct", value:15, max:100000, min:0, exp:"2027-01-10", title:"Giảm 15%", sub:"Hoàn thành X", src:"challenge", ref:"fin_" + d.challengeId, server:true } });
               __fs.fns.myVouchers = ()=> ({ vouchers:[{ code:"TE-ZZ99", kind:"amount", value:20000, src:"points", server:true }] });`);
      const r = JSON.parse(JSON.stringify(await app.ev(`cloudEvents.claimChallengeVoucher("ch1")`)));
      assert.equal(r.ok, true); assert.equal(r.voucher.ref, "fin_ch1");
      assert.deepEqual(app.evj(`__fs.calls.find(c=> c[0] === "claimChallengeVoucher")[1]`), { challengeId:"ch1" });
      assert.equal(JSON.parse(JSON.stringify(await app.ev(`cloudEvents.myVouchers()`)))[0].code, "TE-ZZ99");
      // demo
      const demo = await t.app({ scripts:["cloud-events.js"], state:false, settleMs:5 });
      demo.run(`globalThis.state = { profile:{} };`); await demo.ev("cloudEvents.init()");
      assert.equal(demo.ev("cloudEvents.mode"), "demo");
      assert.equal(await demo.ev(`cloudEvents.claimChallengeVoucher("ch1")`), null);
      assert.deepEqual(JSON.parse(JSON.stringify(await demo.ev(`cloudEvents.myVouchers()`))), []);
    });
    t.test("I-02b: events.js settleAll (Firebase) — voucher hoàn thành = bản sao server:true từ claimChallengeVoucher; Function chưa sẵn sàng → 'pending' (không cấp voucher trên máy); demo giữ nguyên", async ()=>{
      const app = await t.app({ settleMs:120, state:{ profile: PROF({ name:"QA Fin" }) } });
      await app.ev(`(async()=>{ await cloud.signUp("fin.int@tapeasy.vn", "matkhau1", "QA Fin"); await cloudEvents.init(); })()`);
      app.run(`Object.defineProperty(cloudEvents, "mode", { get(){ return "firebase"; }, configurable:true }); globalThis.__claims = [];
        cloudEvents.claimChallengeVoucher = async id=>{ __claims.push(id); return globalThis.__claimRes; };`);
      // 1) máy chủ chưa sẵn sàng → pending, không có voucher
      app.run(`globalThis.__claimRes = { ok:false, pending:true }; globalThis.__j = {};`);
      assert.equal(await app.ev(`TapEv._t.claimFinVoucher({ id:"ch_a", title:"Chạy 50 km" }, __j)`), "pending");
      assert.equal(app.ev(`__j.finVoucher`), "pending");
      assert.equal(app.ev(`TapShop.hasVoucherRef("fin_ch_a")`), false, "Firebase không được cấp voucher trên máy khi máy chủ chưa xác nhận");
      // 2) máy chủ cấp → bản sao server:true, đúng mã máy chủ
      app.run(`globalThis.__claimRes = { ok:true, voucher:{ code:"TE-SRV12345", kind:"pct", value:15, max:100000, min:0, exp:"2027-01-10", title:"Giảm 15% (tối đa 100.000 ₫)", sub:"Hoàn thành Chạy 50 km", src:"challenge", ref:"fin_ch_a", server:true } };`);
      assert.equal(await app.ev(`TapEv._t.claimFinVoucher({ id:"ch_a", title:"Chạy 50 km" }, __j)`), "ok");
      const v = app.evj(`state.tapShop.vouchers.find(x=> x.ref === "fin_ch_a")`);
      assert.ok(v && v.code === "TE-SRV12345" && v.server === true && v.kind === "pct" && v.value === 15, JSON.stringify(v));
      assert.equal(app.ev(`"finVoucher" in __j`), false);
      // 3) gọi lại → không gọi máy chủ lần nữa
      const n = app.ev(`__claims.length`);
      assert.equal(await app.ev(`TapEv._t.claimFinVoucher({ id:"ch_a", title:"Chạy 50 km" }, __j)`), "ok");
      assert.equal(app.ev(`__claims.length`), n, "đã có voucher mà vẫn gọi máy chủ");
      // 4) máy chủ từ chối (không đủ điều kiện theo số máy chủ) → none
      app.run(`globalThis.__claimRes = { ok:false, error:"Chưa hoàn thành mục tiêu theo số máy chủ ghi nhận." }; globalThis.__j2 = {};`);
      assert.equal(await app.ev(`TapEv._t.claimFinVoucher({ id:"ch_b", title:"B" }, __j2)`), "none");
      const src = read("events.js");
      assert.ok(/cloudEvents\.mode === "firebase"\)\{[\s\S]{0,400}claimFinVoucher\(ch, j\)/.test(src), "settleAll (Firebase) chưa dùng claimFinVoucher");
      assert.ok(/j\.finVoucher === "pending"[\s\S]{0,80}claimFinVoucher/.test(src), "chưa thử lại voucher đang chờ");
    }, { bug:"FIX-security#2", severity:"Cao" });
    t.test("I-02c: shop.js — Firebase: mở Cửa hàng gộp myVouchers vào ví (khử trùng theo mã; thay bản trên máy chưa xác nhận); demo không gọi", async ()=>{
      const app = await t.app({ settleMs:120, state:{ profile: PROF({ name:"QA Ví" }) } });
      await app.ev(`(async()=>{ await cloud.signUp("vi.int@tapeasy.vn", "matkhau1", "QA Ví"); await cloudEvents.init(); })()`);
      app.run(`globalThis.__mv = 0; cloudEvents.myVouchers = async ()=>{ __mv++; return [
          { code:"TE-PT0001", kind:"amount", value:20000, min:0, max:0, exp:"2027-01-01", title:"Giảm 20.000 ₫", src:"points", server:true },
          { code:"TE-FIN0001", kind:"pct", value:15, min:0, max:100000, exp:"2027-01-01", title:"Giảm 15%", src:"challenge", ref:"fin_ch_x", server:true } ]; };`);
      assert.equal(await app.ev(`TapShop.syncServerVouchers(true)`), 0, "demo không được gộp voucher máy chủ");
      assert.equal(app.ev("__mv"), 0);
      app.run(`Object.defineProperty(cloudEvents, "mode", { get(){ return "firebase"; }, configurable:true });
        TapShop.grantVoucher({ kind:"pct", value:15, max:100000, title:"Voucher cũ (máy)", ref:"fin_ch_x" });`);
      assert.equal(await app.ev(`TapShop.syncServerVouchers(true)`), 2);
      const vs = app.evj(`state.tapShop.vouchers.filter(v=> /^TE-(PT|FIN)0001$/.test(v.code) || v.ref === "fin_ch_x")`);
      assert.equal(vs.filter(v=> v.ref === "fin_ch_x").length, 1, "bản trên máy chưa xác nhận phải được thay");
      assert.ok(vs.find(v=> v.code === "TE-FIN0001" && v.server === true && v.ref === "fin_ch_x"));
      assert.ok(vs.find(v=> v.code === "TE-PT0001" && v.server === true && v.ref === "redeem_TE-PT0001"));
      assert.equal(await app.ev(`TapShop.syncServerVouchers(true)`), 0, "gọi lại phải khử trùng theo mã");
      assert.ok(/syncServerVouchers\(\)\.then/.test(read("shop.js").slice(read("shop.js").indexOf("function openStore("))), "mở Cửa hàng chưa gộp voucher máy chủ");
    });

    /* ---------------- I-03 · statusLog học viên ---------------- */
    t.test("I-03 (FIX-security vòng 2 #3): học viên đánh dấu 'Đã tập' → giữ dòng statusLog { from:'scheduled', to:'done', by:'student', uid } (rules vòng 2 nhận) — không còn xoá ở Firebase", async ()=>{
      const app = await t.app({ settleMs:60 });
      const pol = app.evj(`cloud.social.policy.sessionPolicy("student", { id:"s1", status:"scheduled", date:"2026-11-11", statusLog:[] }, { id:"s1", status:"done" }, "2026-11-11", "stu1")`);
      assert.equal(pol.patch.status, "done");
      const last = pol.patch.statusLog[pol.patch.statusLog.length - 1];
      assert.ok(last && last.from === "scheduled" && last.to === "done" && last.by === "student" && last.uid === "stu1" && typeof last.at === "number", JSON.stringify(last));
      const src = read("cloud-social.js");
      assert.ok(!/delete pol\.patch\.statusLog/.test(src), "cloud-social.js vẫn xoá statusLog của học viên ở Firebase");
    });

    /* ---------------- I-04 … I-08 · Ẩn số calo ở Trang chủ / Hồ sơ ---------------- */
    t.test("I-04/I-06: 'Ẩn số calo' (tiền sử RLĂU) → Trang chủ ô 'Bữa đã ghi n/4' (không kcal); Hồ sơ không số kcal; sheet mục tiêu không có ô kcal (có lối hiện lại); tắt → hiện lại", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF(), health: HS({ edHistory:"yes" }) } });
      app.setNow(NOW); app.run("recomputeProfile()");
      assert.equal(app.ev("fkHideKcal()"), true);
      app.run(`(()=>{ const L = getDayFoodLog(); L.lunch.push({ name:"Cơm", foodId:"com-trang", grams:150, kcal:195, protein:4, carbs:42, fat:0.5 }); })(); renderHomeScreen();`);
      const h = app.lastHtml("home-content");
      assert.ok(/data-kcal-hidden/.test(h) && /1\/4/.test(h) && /bữa đã ghi/.test(h), "thiếu ô 'Bữa đã ghi n/4'");
      assert.ok(!/kcal/i.test(txt(h)) && !/Calo hôm nay/.test(h), "Trang chủ còn số calo: " + (txt(h).match(/.{30}kcal.{10}/i) || [""])[0]);
      app.run("renderProfileScreen()");
      assert.equal(app.ev(`document.getElementById("profile-goal-kcal").textContent`), "Theo khẩu phần");
      assert.equal(app.ev(`document.getElementById("profile-bmr").textContent`), "");
      assert.equal(app.ev(`document.getElementById("profile-tdee").textContent`), "");
      assert.ok(/ẩn số calo/i.test(app.ev(`document.getElementById("profile-targets-mode").textContent`)));
      app.run("openEditNutritionTargets()");
      let sh = app.lastHtml("sheet-content");
      assert.ok(!/id="nt-kcal"/.test(sh) && !/kcal/i.test(txt(sh)) && /btn-nt-showkcal/.test(sh), "sheet mục tiêu còn ô kcal khi đang ẩn");
      app.run(`(()=>{ const f = document.getElementById("btn-nt-showkcal")._listeners.click; f[f.length - 1]({}); })()`);
      assert.equal(app.ev("fkHideKcal()"), false, "nút 'Hiện số calo' chưa tắt chế độ ẩn");
      assert.ok(/id="nt-kcal"/.test(app.lastHtml("sheet-content")), "tắt ẩn rồi mà sheet chưa có ô kcal");
      app.run("renderHomeScreen(); renderProfileScreen();");
      assert.ok(/Calo hôm nay/.test(app.lastHtml("home-content")) && !/data-kcal-hidden/.test(app.lastHtml("home-content")));
      assert.ok(/kcal/.test(app.ev(`document.getElementById("profile-goal-kcal").textContent`)));
      // người không khai RLĂU: như cũ
      const plain = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF({ goal:"gain", gender:"male", weight:70, height:172 }), health: HS() } });
      plain.run("renderHomeScreen()");
      assert.ok(/Calo hôm nay/.test(plain.lastHtml("home-content")));
    }, { bug:"FIX-nutrition#1/#3", severity:"Cao" });
    t.test("I-05/I-08: ui-signature.js bỏ thẻ 'kcal đã nạp' tại chỗ gốc khi ẩn số calo; health-safety.js đã gỡ bản tạm hsHomeKcal", ()=>{
      const sig = read("ui-signature.js"), dh = sig.slice(sig.indexOf("function decorateHome(){"), sig.indexOf("F. TYPEWRITER"));
      const iHide = dh.indexOf("nuHideKcal"), iCard = dh.indexOf('card = D.createElement("section")');
      assert.ok(iHide > 0 && iCard > iHide, "decorateHome chưa kiểm nuHideKcal trước khi vẽ thẻ năng lượng");
      assert.ok(/if\(hideK\)\{[^\n]*\.remove\(\)[^\n]*classList\.remove\("sig-gauged"\); return; \}/.test(dh), "chưa gỡ thẻ cũ khi bật ẩn");
      const hs = read("health-safety.js");
      assert.ok(!/function hsHomeKcal/.test(hs) && !/hsHomeKcal\(/.test(hs), "health-safety.js còn bản tạm hsHomeKcal");
    });
    t.test("I-07 (FIX-nutrition vòng 2 #4): 'Đặt lại toàn bộ dữ liệu' xoá cả bộ nhớ thực đơn nutrition-pro (fitkit_np_plans_v1)", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF({ goal:"gain" }), health: HS() } });
      app.run(`localStorage.setItem("fitkit_np_plans_v1", JSON.stringify({ v:"np3", keys:["a"], plans:{ a:[1] } }));`);
      app.run(`(()=>{ const a = document.getElementById("btn-reset-app")._listeners.click; a[a.length - 1]({}); })()`);
      await app.ev(`(async()=>{ const b = document.getElementById("btn-confirm-reset")._listeners.click; await b[b.length - 1]({}); })()`);
      assert.equal(app.localStorage.getItem("fitkit_np_plans_v1"), null, "bộ nhớ thực đơn chưa bị xoá");
      assert.equal(app.localStorage.getItem("fitkit_state_v1"), null);
    });

    /* ---------------- I-09 · video khi mất mạng ---------------- */
    t.test("I-09 (FIX-core vòng 2 #5): mất mạng → index.json chỉ tải 1 lần rồi nhớ lỗi ≥ 60 s; sau 60 s hoặc sự kiện 'online' tải lại; navigator.onLine=false → 0 request; refreshPlanVideos không xoá video / không đánh dấu khi chưa có index", async ()=>{
      const app = await t.app({ fixtures:{ "media/wger/index.json":"__offline__", "media/extra/index.json":"__offline__" } });
      app.setNow(NOW);
      const idx = ()=> app.fetchLog.filter(u=> /media\/(wger|extra)\/index\.json/.test(u)).length;
      const n0 = idx();
      for(let i = 0; i < 6; i++) await app.ev(`findFreeExerciseVideos(EXERCISES.hipthrust)`);
      assert.ok(idx() - n0 <= 2, "mất mạng mà vẫn gửi " + (idx() - n0) + " request index.json cho 6 lần tìm");
      app.setNow(NOW + 30e3); await app.ev(`findFreeExerciseVideos(EXERCISES.squat)`);
      assert.ok(idx() - n0 <= 2, "chưa tới 60 s đã thử lại");
      app.setNow(NOW + 61e3); await app.ev(`findFreeExerciseVideos(EXERCISES.squat)`);
      assert.ok(idx() - n0 >= 3, "sau 60 s không thử lại");
      // vẫn mất mạng: lần lỗi thứ 2 → chờ lâu hơn (120 s)
      const n1 = idx(); app.setNow(NOW + 61e3 + 90e3); await app.ev(`findFreeExerciseVideos(EXERCISES.squat)`);
      assert.equal(idx(), n1, "lùi dần: lỗi lần 2 phải chờ ≥ 120 s");
      // refreshPlanVideos khi chưa có index: không xoá video cũ, không đánh dấu đã làm hôm nay
      app.run(`state.plans.__v = { id:"__v", name:"V", days:{ T2:{ items:[{ uid:"a", exerciseId:"hipthrust", stock:{ provider:"Pixabay", url:"https://pixabay/x.mp4" } }] } } }; delete state.videoRefreshAt;`);
      await app.ev(`refreshPlanVideos(true)`);
      assert.equal(app.ev(`state.plans.__v.days.T2.items[0].stock && state.plans.__v.days.T2.items[0].stock.url`), "https://pixabay/x.mp4", "mất mạng mà vẫn xoá video cũ");
      assert.ok(!app.ev(`state.videoRefreshAt`), "mất mạng mà vẫn đánh dấu đã làm mới hôm nay");
      app.run(`delete state.plans.__v`);
      // có mạng lại + sự kiện online → tải ngay
      app.fixtures["media/wger/index.json"] = "wger-index.json"; app.fixtures["media/extra/index.json"] = "extra-index.json";
      app.run(`(globalThis.__winListeners.online || []).forEach(f=> f({ type:"online" }))`);
      const r = JSON.parse(JSON.stringify(await app.ev(`findFreeExerciseVideos(EXERCISES.hipthrust)`)));
      assert.ok(r.length > 0, "sự kiện online chưa xoá nhớ lỗi");
      // trình duyệt báo offline → không gửi request
      const off = await t.app({ fixtures:{ "media/wger/index.json":"__offline__", "media/extra/index.json":"__offline__" } });
      off.run(`navigator.onLine = false`);
      const m0 = off.fetchLog.length; await off.ev(`findFreeExerciseVideos(EXERCISES.squat)`);
      assert.equal(off.fetchLog.filter((u, i)=> i >= m0 && /index\.json/.test(u)).length, 0);
    }, { bug:"FIX-core#5", severity:"Cao" });
    t.test("I-09b: video.js — lỗi KẾT NỐI tới API video được nhớ 60 s (không gọi lại cho từng bài); 'online' xoá nhớ lỗi", async ()=>{
      const app = await t.app({ fixtures:{ "pixabay.com/api/videos/":"__offline__" } });
      app.setNow(NOW); app.run(`state.mediaSettings.pixabayKey = "k"`);
      const api = ()=> app.fetchLog.filter(u=> /pixabay\.com\/api/.test(u)).length;
      const errOf = async q=>{ try{ await app.ev(`searchVideos(${JSON.stringify(q)})`); return ""; }catch(e){ return e.message; } };
      assert.match(await errOf("squat a"), /Không kết nối được/);
      const n = api();
      assert.match(await errOf("squat b"), /Không kết nối được/);
      assert.match(await errOf("squat c"), /Không kết nối được/);
      assert.equal(api(), n, "trong 60 s vẫn gọi API video");
      app.setNow(NOW + 61e3); await errOf("squat d");
      assert.equal(api(), n + 1, "sau 60 s không thử lại");
      app.run(`(globalThis.__winListeners.online || []).forEach(f=> f({ type:"online" }))`);
      app.fixtures["pixabay.com/api/videos/"] = "pixabay-videos.json";
      assert.equal(await errOf("walking"), "");
    });

    /* ---------------- I-10 · popup thành tích lúc mở app ---------------- */
    t.test("I-10 (FIX-core vòng 2 #6): popup + pháo giấy hoãn tới khi đã ở trong app ≥ 6 s, không có lớp phủ; huy hiệu 'cũ' (đạt trước hôm qua) ghi nhận lặng lẽ", async ()=>{
      const app = await t.app({ state:{ profile: PROF({ goal:"gain" }), health: HS() } });
      const U = "FKAch._ui";
      assert.equal(app.ev(`${U}.achIsOld("2026-11-09", "2026-11-11")`), true);
      assert.equal(app.ev(`${U}.achIsOld("2026-11-10", "2026-11-11")`), false, "hôm qua vẫn là mới");
      assert.equal(app.ev(`${U}.achIsOld("2026-11-11", "2026-11-11")`), false);
      // vừa mở app: đưa 1 popup vào hàng đợi → chưa hiện
      const real = Date.now(); app.setNow(real);
      const kids = ()=> app.ev(`document.getElementById("app-shell").children.length`);
      const k0 = kids();
      assert.ok(app.ev(`${U}.achQuietLeft()`) > 3000, "chưa có khoảng lặng sau khi mở app");
      app.run(`${U}.queue.push({ type:"level", lv:{ lvl:2, title:"Khởi động", xp:120, rank:"Đồng" } }); ${U}.tryShow(true);`);
      assert.equal(kids(), k0, "popup hiện ngay lúc mở app");
      app.setNow(real + 7000);
      assert.equal(app.ev(`${U}.achQuietLeft()`), 0);
      app.run(`document.getElementById("onboarding").classList.add("open"); ${U}.tryShow(true);`);
      assert.equal(kids(), k0, "popup đè lên onboarding");
      app.run(`document.getElementById("onboarding").classList.remove("open"); ${U}.tryShow(true);`);
      assert.equal(kids(), k0 + 1, "đủ điều kiện mà popup không hiện");
      // huy hiệu cũ: lịch sử 6 buổi tháng 10 → ghi nhận nhưng không vào hàng đợi
      const old = await t.app({ state:{ profile: PROF({ goal:"gain" }), health: HS(), finishedDates:["2026-10-01","2026-10-03","2026-10-05","2026-10-07","2026-10-09","2026-10-11"],
        achievements:{ init:"2026-09-01", earned:{}, level:1, xp:0 } } });
      old.setNow(NOW);
      old.run(`FKAch._ui.queue.length = 0; FKAch.check({ force:true });`);
      const earned = old.evj(`Object.keys(state.achievements.earned)`);
      assert.ok(earned.length >= 1, "không tính được huy hiệu từ lịch sử");
      assert.equal(old.ev(`FKAch._ui.queue.filter(x=> x.type !== "level").length`), 0, "huy hiệu đạt từ tháng trước vẫn bật popup");
      const src = read("achievements.js");
      assert.ok(/if\(reduceMotion\(\) \|\| lowEndDevice\(\)\) return;/.test(src), "pháo giấy chưa tắt ở máy yếu");
    }, { bug:"FIX-core#6", severity:"TB" });

    /* ---------------- I-11 … I-16 ---------------- */
    t.test("I-11/I-12: index.html có nút tab tĩnh 'Kỷ lục' đứng đầu #progress-tabs (đang chọn); ui-kit.css ẩn dòng lối tắt [hidden] của menu", ()=>{
      const html = read("index.html"), m = html.match(/<div class="day-tabs" id="progress-tabs"[^>]*>([\s\S]*?)<\/div>/);
      assert.ok(m, "thiếu #progress-tabs");
      const btns = m[1].match(/data-ptab="(\w+)"/g).map(x=> x.slice(11, -1));
      assert.deepEqual(btns, ["records", "photos", "inbody"]);
      assert.ok(/class="day-tab active" data-ptab="records"/.test(m[1]) && !/class="day-tab active" data-ptab="photos"/.test(m[1]));
      assert.ok(/\.link-row\.te-mdeep\[hidden\]\{ display:none; \}/.test(read("ui-kit.css")));
    });
    t.test("I-13 (FIX-core vòng 2 #3): thẻ Khối lượng tuần (training-pro) chỉ chèn ở tab 'Kỷ lục' của màn Tiến độ", async ()=>{
      const app = await t.app({ state:{ profile: PROF({ goal:"gain" }), health: HS() } });
      const vol = ()=> app.dom.htmlLog.filter(x=> /tp-vol-card/.test(x.html)).length;
      app.run(`progressUI.tab = "photos"`); let n = vol(); app.run("renderProgressScreen()");
      assert.equal(vol(), n, "tab Ảnh vẫn chèn thẻ Khối lượng tuần");
      app.run(`progressUI.tab = "inbody"`); n = vol(); app.run("renderProgressScreen()");
      assert.equal(vol(), n, "tab InBody vẫn chèn thẻ Khối lượng tuần");
      app.run(`progressUI.tab = "records"`); n = vol(); app.run("renderProgressScreen()");
      assert.ok(vol() > n, "tab Kỷ lục mất thẻ Khối lượng tuần");
    });
    t.test("I-14/I-15: siêu hiệp 'Ghi nhận tất cả' đánh dấu _bulk (buổi < 3 phút không tính); pt-connect không gửi kết quả buổi PT bị chặn tooShort", ()=>{
      const tp = read("training-pro.js");
      assert.ok(/rowsArr\.forEach\(rows=> rows\.forEach\(r=>\{ r\.done = true; r\._bulk = true; \}\)\)/.test(tp), "siêu hiệp chưa đặt _bulk");
      assert.ok(/s\._pt && !s\.tooShort\) finishPTSession/.test(read("pt-connect.js")), "buổi PT < 3 phút vẫn gửi finishPTSession");
    });
    t.test("I-14b: buổi < 3 phút chỉ có hiệp _bulk → fkSessionCounts = false (đồng nhất app.js ↔ training-pro)", async ()=>{
      const app = await t.app({ state:{ profile: PROF({ goal:"gain" }), health: HS() } });
      app.setNow(NOW);
      assert.equal(app.ev(`fkSessionCounts({ startedAt: ${NOW - 60e3}, sets:{ a:[{ done:true, _bulk:true, reps:10 }, { done:true, _bulk:true, reps:10 }] } })`), false);
      assert.equal(app.ev(`fkSessionCounts({ startedAt: ${NOW - 60e3}, sets:{ a:[{ done:true, reps:10 }] } })`), true);
    });
    t.test("I-16 (FIX-core vòng 2 #8): chữ menu ☰ tại nguồn events.js theo GLOSSARY (Sự kiện · Gặp mặt & vé · Cửa hàng)", ()=>{
      const ev = read("events.js");
      assert.ok(/add\("hub", "challenges", "te_trophy", "Sự kiện"\)/.test(ev) && /add\("hub", "events", "te_ticket", "Gặp mặt &amp; vé"\)/.test(ev) && /add\("hub", "shop", "storefront", "Cửa hàng"\)/.test(ev));
      assert.ok(!/Sự kiện offline &amp; vé"\), first/.test(ev) && !/"Cửa hàng TapEasy"\), first/.test(ev));
    });

    /* ---------------- I-17 … I-25 ---------------- */
    t.test("I-17/I-18/I-24: dấu báo cáo có uid (routine, đánh giá PT) để xoá tài khoản dọn được; bỏ chữ 'mã 6 ký tự'; routineReportHeal ghi autoModWeight cả khi 'ẩn' không đổi", ()=>{
      assert.ok(/tx\.set\(sub, \{ reason, ts: now\(\), uid \}\)/.test(read("cloud-social.js")));
      const dir = read("cloud-pt-directory.js");
      assert.ok(/tx\.set\(mark, \{ reason, at: now\(\), uid: by \}\)/.test(dir));
      assert.ok(!/mã 6 ký tự/.test(dir) && !/mã 6 ký tự/.test(read("cloud-social.js")));
      const fn = read("functions/commerce.js"), heal = fn.slice(fn.indexOf("exports.routineReportHeal"), fn.indexOf("MOMENT_TRUST_DAYS"));
      assert.ok(/else if\(Number\(d\.autoModWeight\) !== w\) await rRef\.update\(\{ autoModWeight: w \}\)/.test(heal));
    });
    t.test("I-19 (FIX-security vòng 2 #6): khoá Pixabay đã lộ không còn trong mã client", ()=>{
      assert.match(read("media-config.js"), /pixabayKey: "",/);
      const leaked = fs.readdirSync(ROOT).filter(f=> /\.(js|html)$/.test(f)).filter(f=> /58526802-1bdd38af/.test(read(f)));
      assert.deepEqual(leaked, []);
    }, { bug:"FIX-security#6", severity:"Cao" });
    t.test("I-20/I-21: hộp xác nhận chặn chỉ đúng nơi bỏ chặn; confirmDialog giữ tấm khi onConfirm async lỗi, đóng khi xong", async ()=>{
      assert.ok(/Cộng đồng hoặc màn PT → Người đã chặn/.test(read("events.js")) && /Cộng đồng hoặc màn PT → Người đã chặn/.test(read("community.js")));
      const app = await t.app({ state:{ profile: PROF({ goal:"gain" }), health: HS() } });
      const open = ()=> app.ev(`document.getElementById("sheet-backdrop").classList.contains("open")`);
      const click = ()=> app.run(`(()=>{ const f = document.getElementById("cd-confirm")._listeners.click; f[f.length - 1]({}); })()`);
      app.run(`confirmDialog("A", "b", ()=>{ globalThis.__sync = 1; }, "OK")`); click();
      assert.equal(app.ev("__sync"), 1); assert.equal(open(), false, "onConfirm đồng bộ phải đóng ngay như cũ");
      app.run(`confirmDialog("A", "b", ()=> Promise.reject(new Error("x")), "OK")`); click();
      await app.settle(10);
      assert.equal(open(), true, "lỗi async mà tấm đã đóng");
      assert.equal(app.ev(`document.getElementById("cd-confirm").disabled`), false, "lỗi rồi mà nút vẫn khoá");
      app.run(`globalThis.__res = null; confirmDialog("A", "b", ()=> new Promise(r=> globalThis.__res = r), "OK")`); click();
      assert.equal(open(), true, "đang chờ mà tấm đã đóng");
      assert.equal(app.ev(`document.getElementById("cd-confirm").disabled`), true);
      app.run(`__res()`); await app.settle(10);
      assert.equal(open(), false, "xong rồi mà tấm chưa đóng");
    });
    t.test("I-25 (FIX-ux vòng 2 → workflows): bản phát hành gọi prepare-www.sh với STORE_BUILD=1", ()=>{
      assert.match(read(".github/workflows/ios-appstore.yml"), /STORE_BUILD=1 bash scripts\/prepare-www\.sh/);
      assert.match(read(".github/workflows/build-android.yml"), /STORE_BUILD=\$\(\[ "\$HAS_KEY" = "true" \] && echo 1 \|\| echo 0\) bash scripts\/prepare-www\.sh/);
    });
  },
};

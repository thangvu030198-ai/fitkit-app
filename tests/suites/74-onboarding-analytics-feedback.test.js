/* =========================================================================
   Onboarding hoàn chỉnh · Thống kê ẩn danh có đồng ý · Vòng phản hồi (13/11/2026)
   Chạy riêng: node tests/run.js --only 74-onboarding
   - analytics.js: mặc định TẮT → fkTrack không ghi/gửi gì; DNT; lọc PII; băm mã người dùng; SDK chỉ tải sau đồng ý
   - feedback.js: kiểm dữ liệu góp ý/NPS, lịch hỏi NPS (buổi thứ 5 / 7 ngày / 90 ngày), hàng đợi offline, "Có gì mới"
   - firestore.rules: feedback chỉ tạo + kiểm trường; chỉ quản trị đọc
   - app.js onboarding: bộ đếm bước + aria, lỗi từng ô, sửa từ Hồ sơ, nơi tập/số buổi → giáo án, màn "Kế hoạch đã sẵn sàng"
     dùng CHÍNH calcBMR/calcTDEE/calcMacros/nuWaterGoal (không lặp công thức)
   - đóng gói: CSP hợp lệ, sw.js ASSETS + prepare-www.sh có file mới, thứ tự nạp
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert, expectNone } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
const DAY = 86400000;
const HEALTH_DONE = { completedAt: Date.now(), ack: true, parq: {} };
/** khối { … } ngay sau `head` (đếm ngoặc) */
function block(src, head){
  const i = src.indexOf(head); if(i < 0) return "";
  const j = src.indexOf("{", i + head.length); let d = 0;
  for(let k = j; k < src.length; k++){ if(src[k] === "{") d++; else if(src[k] === "}"){ d--; if(!d) return src.slice(i, k + 1); } }
  return src.slice(i);
}
/** thân hàm `function name(` trong mã nguồn */
function fnBody(src, name){ return block(src, "function " + name + "("); }

module.exports = {
  name: "Onboarding · thống kê ẩn danh có đồng ý · góp ý & NPS",
  area: "app.js · analytics.js · feedback.js · cloud.js · admin.js · firestore.rules · index.html · sw.js · prepare-www.sh",
  async define(t){
    const html = read("index.html"), appJs = read("app.js"), an = read("analytics.js"), fb = read("feedback.js");

    /* ---------------- 1. ANALYTICS: đồng ý ---------------- */
    t.test("Đồng ý mặc định TẮT → fkTrack không ghi, không xếp hàng, không tải SDK (kể cả khi đã cấu hình PostHog)", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      const appended = [];
      app.run(`MEDIA_CONFIG.posthogKey = "phc_test_placeholder";`);
      app.run(`(()=>{ const h = document.head; const o = h.appendChild.bind(h); h.appendChild = el=>{ globalThis.__appended = (globalThis.__appended||[]).concat(String(el && el.src || "")); return o(el); }; })()`);
      assert.equal(app.ev("FKAnalytics.consent()"), false);
      assert.equal(app.ev("FKAnalytics.shouldAsk()"), true, "lần đầu phải hỏi");
      assert.equal(app.ev(`fkTrack("workout_start", { day_key:"T2" })`), false);
      app.run(`goto("nutrition"); goto("home");`);
      assert.equal(app.ev(`fkScreen("profile")`), false);
      assert.deepEqual(app.evj("FKAnalytics.log()"), [], "nhật ký cục bộ phải rỗng khi chưa đồng ý");
      assert.equal(app.ev("FKAnalytics._Q.length"), 0, "không xếp hàng khi chưa đồng ý");
      assert.ok(app.ev("FKAnalytics.stats.dropped") >= 2);
      assert.ok(!(app.ev("globalThis.__appended") || []).some(s=> /posthog|firebase-analytics|googletagmanager/.test(s)), "không được tải SDK thống kê khi chưa đồng ý");
      assert.equal(app.localStorage.getItem("fk_analytics_log"), null);
      assert.ok(!app.fetchLog.some(u=> /posthog|google-analytics|googletagmanager/.test(u)), "có request thống kê khi chưa đồng ý");
      // Đồng ý → ghi được, SDK PostHog được tải (lười)
      app.run(`FKAnalytics.setConsent(true, "test")`);
      assert.equal(app.ev(`fkTrack("workout_start", { day_key:"T2", email:"a@b.vn" })`), true);
      const log = app.evj("FKAnalytics.log()");
      const ev = log.find(e=> e.e === "workout_start");
      assert.ok(ev, "chưa ghi sự kiện sau khi đồng ý");
      assert.equal(ev.p.day_key, "T2"); assert.ok(!("email" in ev.p), "lọt email");
      assert.ok(ev.p.app_version && ev.p.platform, "thiếu thuộc tính chung");
      assert.ok((app.ev("globalThis.__appended") || []).some(s=> /eu-assets\.i\.posthog\.com\/static\/array\.js/.test(s)), "PostHog SDK phải tải lười sau đồng ý (host EU)");
      // Rút lại → xoá nhật ký, không ghi tiếp
      app.run(`FKAnalytics.setConsent(false, "test")`);
      assert.deepEqual(app.evj("FKAnalytics.log()"), []);
      assert.equal(app.ev(`fkTrack("workout_finish", {})`), false);
      app.run(`MEDIA_CONFIG.posthogKey = "";`);
    });

    t.test("Do Not Track / GPC → không hỏi, giữ tắt; thẻ hỏi không hiện khi đang onboarding; nút Đồng ý / Không lưu lựa chọn", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      app.run(`navigator.doNotTrack = "1"`);
      assert.equal(app.ev("FKAnalytics.dnt()"), true);
      assert.equal(app.ev("FKAnalytics.shouldAsk()"), false);
      assert.equal(app.ev("FKAnalytics.askConsent(false)"), false);
      app.run(`navigator.doNotTrack = undefined; navigator.globalPrivacyControl = true`);
      assert.equal(app.ev("FKAnalytics.shouldAsk()"), false);
      app.run(`navigator.globalPrivacyControl = false; document.getElementById("onboarding").classList.add("open")`);
      assert.equal(app.ev("FKAnalytics.askConsent(false)"), false, "không chen vào onboarding");
      app.run(`document.getElementById("onboarding").classList.remove("open"); document.getElementById("sheet-backdrop").classList.remove("open")`);
      assert.equal(app.ev("FKAnalytics.askConsent(false)"), true);
      const h = app.lastHtml("fk-consent");
      assert.match(h, /Thống kê sử dụng ẩn danh/); assert.match(h, /Mặc định tắt/);
      assert.match(h, /id="fk-consent-usage"[^>]*role="switch"/); assert.doesNotMatch(h, /id="fk-consent-usage"[^>]*checked/, "công tắc không được bật sẵn");
      app.dom.registry.get("fk-consent-no").click();
      assert.equal(app.ev("FKAnalytics.consent()"), false);
      assert.equal(app.ev("FKAnalytics.shouldAsk()"), false, "đã trả lời → không hỏi lại");
      assert.equal(JSON.parse(app.localStorage.getItem("fk_analytics_v1")).consent, "denied");
      app.dom.registry.get("fk-consent-yes").click();
      assert.equal(app.ev("FKAnalytics.consent()"), true);
    });

    /* ---------------- 2. ANALYTICS: không PII ---------------- */
    t.test("Lọc PII: bỏ khoá nhạy cảm, thay giá trị email/SĐT, bỏ object lồng; giữ recipe_id/platform/items/ngày; tên sự kiện snake_case", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      const out = app.evj(`FKAnalytics.sanitize({ email:"a@b.vn", phone:"0901234567", name:"Thắng", full_name:"X", user_id:"u1", uid:"abc", address:"HN",
        contact:"x", note:"riêng tư", text:"abc", recipe_id:"pho-bo", platform:"web", items:3, ok:true, nested:{ a:1 }, list:[1,2],
        desc:"gọi 0912 345 678 nhé", mail_to:"z", ref:"me@x.com", date:"2026-11-13", weight_bucket:70, lat:21.0, long_value:"${"a".repeat(150)}" })`);
      for(const k of ["email","phone","name","full_name","user_id","uid","address","contact","note","text","nested","list","mail_to","lat"]) assert.ok(!(k in out), "lọt khoá " + k);
      assert.equal(out.recipe_id, "pho-bo"); assert.equal(out.platform, "web"); assert.equal(out.items, 3); assert.equal(out.ok, true);
      assert.equal(out.desc, "[redacted]"); assert.equal(out.ref, "[redacted]");
      assert.equal(out.date, "2026-11-13", "ngày không phải SĐT");
      assert.equal(out.long_value.length, 100, "chuỗi dài phải cắt 100 ký tự");
      assert.equal(app.ev(`FKAnalytics.cleanEvent("Workout Start!")`), "workout_start");
      assert.equal(app.ev(`FKAnalytics.cleanEvent("<img onerror=x>")`), "img_onerror_x");
      assert.equal(app.ev(`FKAnalytics.cleanEvent("1abc")`), "");
      const h1 = await app.ev(`FKAnalytics.hashId("uid-123")`), h2 = await app.ev(`FKAnalytics.hashId("uid-123")`), h3 = await app.ev(`FKAnalytics.hashId("uid-124")`);
      assert.match(h1, /^u_[0-9a-f]{16}$/); assert.equal(h1, h2, "băm phải ổn định"); assert.notEqual(h1, h3);
      assert.ok(!h1.includes("uid-123"));
      // identify (đã đồng ý) không ghi uid thật
      app.run(`FKAnalytics.setConsent(true, "test")`);
      await app.ev(`fkIdentify("uid-123", { email:"a@b.vn", level:"beginner" })`);
      const s = JSON.stringify(app.evj("FKAnalytics.log()"));
      assert.ok(!s.includes("uid-123") && !s.includes("a@b.vn"), "nhật ký lọt uid/email: " + s);
    });

    t.test("Đo phễu: màn hình, đổi giao diện, ghi món, đăng nhập (chỉ phương thức), buổi tập — sau khi đồng ý", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile:{ name:"T", gender:"male", age:28, height:172, weight:70, activity:"moderate", goal:"gain", autoTargets:true } } });
      app.run(`FKAnalytics.setConsent(true, "test")`);
      app.run(`goto("nutrition")`);
      app.run(`fkTheme.set("navy")`);
      app.run(`getDayFoodLog().lunch.push({ name:"Cơm", grams:150, kcal:200, protein:4, carbs:44, fat:0 }); saveState();`);
      await app.ev(`cloud.signUp("x@y.vn", "123456", "Người thử")`);
      app.run(`ensurePlans(); const pl = getActivePlan(); const k = Object.keys(pl.days).find(k=> pl.days[k].items.length); state.selectedDay = k; session = null;
        startSession(todayDayKey()); if(!session){ const mk = document.getElementById("mk-go"); if(mk) mk.click(); }`);
      const evs = app.evj("FKAnalytics.log()").map(e=> e.e);
      for(const e of ["analytics_consent", "screen_view", "theme_change", "meal_logged", "signup"]) assert.ok(evs.includes(e), "thiếu sự kiện " + e + " · có: " + evs.join(","));
      const su = app.evj("FKAnalytics.log()").find(e=> e.e === "signup");
      assert.equal(su.p.method, "email"); assert.ok(!JSON.stringify(su).includes("x@y.vn"));
      const ml = app.evj("FKAnalytics.log()").find(e=> e.e === "meal_logged");
      assert.deepEqual([ml.p.meal, ml.p.items], ["lunch", 1]);
      // nguồn: các sự kiện phễu được gắn đúng nơi
      for(const e of ["onboarding_step_view", "onboarding_step_complete", "onboarding_finish", "plan_created", "workout_start", "set_logged", "workout_finish", "plan_ready_view", "first_workout_cta"])
        assert.ok(appJs.includes(`"${e}"`), "app.js thiếu " + e);
      for(const e of ["meal_logged", "recipe_view", "pt_profile_view", "pt_contact", "theme_change", "share", "app_open"]) assert.ok(an.includes(`"${e}"`), "analytics.js thiếu " + e);
      for(const e of ["feedback_submitted", "nps_submitted"]) assert.ok(fb.includes(`"${e}"`), "feedback.js thiếu " + e);
      assert.match(read("cloud.js"), /authTrack\("login", "google"\)/);
    });

    /* ---------------- 3. NPS ---------------- */
    t.test("Lịch NPS: sau buổi thứ 5 hoặc 7 ngày dùng; tối đa 1 lần / 90 ngày; 'Để sau' tính là đã hỏi", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      const now = Date.parse("2026-11-13T09:00:00Z");
      const due = s=> app.ev(`FKFeedback.npsDue(${JSON.stringify(s)}, ${now})`);
      assert.equal(due({ firstSeen: now, workouts: 4 }), false, "4 buổi, ngày đầu → chưa");
      assert.equal(due({ firstSeen: now, workouts: 5 }), true, "buổi thứ 5 → hỏi");
      assert.equal(due({ firstSeen: now - 6 * DAY, workouts: 0 }), false, "6 ngày → chưa");
      assert.equal(due({ firstSeen: now - 7 * DAY, workouts: 0 }), true, "7 ngày → hỏi");
      assert.equal(due({ firstSeen: now - 30 * DAY, workouts: 9, npsLastAt: now - 89 * DAY }), false, "chưa đủ 90 ngày");
      assert.equal(due({ firstSeen: now - 200 * DAY, workouts: 9, npsLastAt: now - 91 * DAY }), true, "quá 90 ngày → hỏi lại");
      assert.equal(due({}), false);
      // afterWorkout đếm buổi đã lưu; buổi không lưu không đếm
      app.run(`localStorage.setItem("fk_feedback_v1", JSON.stringify({ firstSeen: Date.now(), workouts: 3, whatsNewSeen: "9999" }))`);
      app.run(`FKFeedback.afterWorkout(true); FKFeedback.afterWorkout(false);`);
      assert.equal(app.evj("FKFeedback.state()").workouts, 4);
      assert.equal(app.ev("FKFeedback.npsDueNow()"), false);
      app.run(`FKFeedback.afterWorkout(true)`);
      assert.equal(app.ev("FKFeedback.npsDueNow()"), true, "buổi thứ 5 → đến hạn");
      // Mở NPS = đã hỏi (dù bấm Để sau) → 90 ngày sau mới hỏi
      app.run(`FKFeedback.openNps("test")`);
      assert.match(app.lastHtml("sheet-content"), /role="radiogroup"[\s\S]*nps-b-10/);
      app.dom.registry.get("nps-later").click();
      assert.equal(app.ev("FKFeedback.npsDueNow()"), false, "vừa hỏi → không hỏi lại");
      assert.ok(Date.now() - app.evj("FKFeedback.state()").npsLastAt < 5000);
      // Tóm tắt NPS
      const s = app.evj(`FKFeedback.npsSummary([10,9,8,7,6,0].map(score=> ({ kind:"nps", score })).concat([{ kind:"feedback", category:"bug" }, { kind:"nps", score: 11 }]))`);
      assert.deepEqual([s.n, s.promoters, s.passives, s.detractors, s.nps], [6, 2, 2, 2, 0]);
      assert.equal(s.dist.length, 11); assert.equal(s.dist[10], 1);
    });

    /* ---------------- 4. Góp ý: kiểm dữ liệu + lưu ---------------- */
    t.test("Kiểm dữ liệu góp ý / NPS (khớp rules): loại, độ dài, điểm 0–10, liên hệ chỉ khi đồng ý, ảnh, trường lạ", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      const V = d=> app.evj(`FKFeedback.validate(${JSON.stringify(d)})`);
      const base = app.evj(`FKFeedback.buildDoc("feedback", { category:"bug", text:"Bấm thêm món bị treo", contact:"a@b.vn", contactOk:false })`);
      assert.ok(V(base).ok, JSON.stringify(V(base)));
      assert.ok(!("contact" in base), "chưa cho phép liên hệ mà vẫn lưu email");
      assert.deepEqual(Object.keys(base.device).sort(), ["lang","mode","os","platform","screen","theme"]);
      assert.ok(!JSON.stringify(base.device).includes("node-test"), "không gửi chuỗi UA đầy đủ");
      const withC = app.evj(`FKFeedback.buildDoc("feedback", { category:"idea", text:"Thêm món chay nhé", contact:"a@b.vn", contactOk:true })`);
      assert.equal(withC.contact, "a@b.vn"); assert.ok(V(withC).ok);
      assert.equal(V(Object.assign({}, base, { category:"spam" })).ok, false);
      assert.equal(V(Object.assign({}, base, { text:"abc" })).ok, false, "quá ngắn");
      assert.equal(V(Object.assign({}, base, { text:"x".repeat(2001) })).ok, false, "quá dài");
      assert.equal(V(Object.assign({}, base, { uid:"u1" })).ok, false, "trường lạ (uid) phải bị chặn");
      assert.equal(V(Object.assign({}, base, { contact:"không phải email" })).ok, false);
      assert.equal(V(Object.assign({}, base, { shot:"javascript:alert(1)" })).ok, false);
      assert.equal(V(Object.assign({}, base, { shot:"data:image/jpeg;base64,AAAA" })).ok, true);
      assert.equal(V(Object.assign({}, base, { shot:"data:image/jpeg;base64," + "A".repeat(250001) })).ok, false, "ảnh quá lớn");
      const nps = app.evj(`FKFeedback.buildDoc("nps", { score: 9, text:"Dễ dùng" })`);
      assert.ok(V(nps).ok); assert.equal(nps.score, 9); assert.ok(!("category" in nps));
      assert.equal(V(Object.assign({}, nps, { score: 11 })).ok, false);
      assert.equal(V(Object.assign({}, nps, { score: 7.5 })).ok, false);
      assert.equal(V(Object.assign({}, nps, { score: -1 })).ok, false);
      assert.equal(V(Object.assign({}, nps, { status:"done" })).ok, false, "không được tự đặt trạng thái");
      assert.equal(V(null).ok, false);
    });

    t.test("Gửi góp ý: demo → 'máy chủ giả' (quản trị đọc được); mất mạng → hàng đợi, có mạng lại → tự gửi; sheet escape nội dung", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      const doc = app.evj(`FKFeedback.buildDoc("feedback", { category:"content", text:"Video bài squat sai góc quay" })`);
      const r1 = await app.ev(`FKFeedback.submit(${JSON.stringify(doc)}).then(r=> JSON.stringify(r))`);
      assert.deepEqual(JSON.parse(r1).queued, false);
      const list = JSON.parse(await app.ev(`cloud.feedback.list().then(l=> JSON.stringify(l))`));
      assert.equal(list.length, 1); assert.equal(list[0].category, "content"); assert.equal(list[0].status, "new"); assert.ok(list[0].createdAt > 0);
      assert.ok(!("uid" in list[0]), "góp ý không được gắn uid");
      // offline
      app.run(`navigator.onLine = false`);
      const r2 = JSON.parse(await app.ev(`FKFeedback.submit(${JSON.stringify(doc)}).then(r=> JSON.stringify(r))`));
      assert.equal(r2.queued, true);
      assert.equal(app.evj("FKFeedback.queue()").length, 1);
      assert.equal(await app.ev(`FKFeedback.flushQueue()`), 0, "offline thì chưa gửi");
      app.run(`navigator.onLine = true`);
      assert.equal(await app.ev(`FKFeedback.flushQueue()`), 1);
      assert.equal(app.evj("FKFeedback.queue()").length, 0);
      assert.equal(JSON.parse(await app.ev(`cloud.feedback.list().then(l=> JSON.stringify(l))`)).length, 2);
      // không hợp lệ → không lưu
      const bad = JSON.parse(await app.ev(`FKFeedback.submit({ kind:"feedback" }).then(r=> JSON.stringify(r))`));
      assert.equal(bad.ok, false); assert.ok(bad.errors.length);
      // đổi trạng thái (quản trị)
      await app.ev(`cloud.feedback.setStatus(${JSON.stringify(list[0].id)}, "done")`);
      assert.equal(JSON.parse(await app.ev(`cloud.feedback.list().then(l=> JSON.stringify(l))`)).find(x=> x.id === list[0].id).status, "done");
      // sheet: mở được, có 4 loại, tự kèm phiên bản; nút gửi với nội dung quá ngắn → báo lỗi, không lưu
      app.run(`FKFeedback.open({ trigger:"test" })`);
      const h = app.lastHtml("sheet-content");
      for(const l of ["Lỗi", "Ý tưởng", "Nội dung", "Khác"]) assert.ok(h.includes(">" + l + "<") || h.includes(l), "thiếu loại " + l);
      assert.match(h, /id="fb-contact-ok"/); assert.match(h, /role="radiogroup"/); assert.match(h, /Tự động kèm: phiên bản/);
      app.dom.registry.get("fb-text").value = "abc";
      app.dom.registry.get("fb-send").click();
      await app.settle(10);
      assert.match(app.dom.registry.get("fb-err").textContent, /ít nhất 5 ký tự/);
    });

    t.test("'Có gì mới': người dùng cũ thấy 1 lần; cài mới không hiện; mở lại được; nhãn 'Từ góp ý'", async ()=>{
      const old = await t.app({ state:{ onboarded:true, authDone:true } });
      assert.equal(old.evj("FKFeedback.state()").whatsNewSeen, "", "người dùng cũ chưa xem");
      assert.equal(old.ev("FKFeedback.openWhatsNew(false)"), true);
      const h = old.lastHtml("sheet-content");
      assert.match(h, /Có gì mới/); assert.match(h, /Đã sửa/); assert.match(h, /Từ góp ý/);
      assert.equal(old.ev("FKFeedback.openWhatsNew(false)"), false, "chỉ hiện 1 lần");
      assert.equal(old.ev("FKFeedback.openWhatsNew(true)"), true, "mở lại từ Hồ sơ");
      const fresh = await t.app({ state:{ onboarded:false, authDone:false } });
      assert.equal(fresh.ev("FKFeedback.openWhatsNew(false)"), false, "cài mới không khoe Có gì mới");
      const ids = old.evj("FKFeedback.CHANGELOG.map(e=> e.id)");
      assert.deepEqual(ids.slice().sort().reverse(), ids, "CHANGELOG phải mới nhất trước");
      ids.forEach(id=> assert.match(id, /^\d{4}-\d{2}-\d{2}$/));
    });

    t.test("Hồ sơ: thẻ 'Góp ý & quyền riêng tư' (công tắc thống kê role=switch), Chính sách bảo mật trong app nhắc thống kê & góp ý", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      app.run(`goto("profile")`);
      const h = app.lastHtml("fk-fb-card");
      assert.match(h, /Góp ý cho TapEasy/); assert.match(h, /Có gì mới/);
      assert.match(h, /id="fk-an-toggle" role="switch"[^>]*aria-checked="false"/);
      app.dom.registry.get("fk-an-toggle").click();
      assert.equal(app.ev("FKAnalytics.consent()"), true);
      assert.match(app.lastHtml("fk-fb-card"), /aria-checked="true"/);
      app.run(`openPrivacySheet()`);
      assert.match(app.lastHtml("sheet-content"), /Thống kê sử dụng ẩn danh \(tuỳ chọn, mặc định tắt\)/);
    });

    /* ---------------- 5. firestore.rules ---------------- */
    t.test("firestore.rules: feedback chỉ tạo (đủ kiểm trường/kích thước, createdAt máy chủ), chỉ quản trị đọc, không xoá; cân ngoặc", ()=>{
      const r = read("firestore.rules"), nc = r.replace(/\/\/[^\n]*/g, "");
      const b = block(nc, "match /feedback/{id}");
      assert.ok(b, "thiếu match /feedback/{id}");
      assert.match(b, /allow create: if signedIn\(\) && notBanned\(\) && okFeedback\(request\.resource\.data\);/);
      assert.match(b, /allow read: if hasPerm\('support\.tickets'\);/);
      assert.match(b, /allow update: if hasPerm\('support\.tickets'\) && onlyKeys\(\['status'\]\)/);
      assert.match(b, /allow delete: if false;/);
      assert.match(b, /d\.createdAt == request\.time/); assert.match(b, /d\.status == 'new' && d\.v == 1/);
      assert.match(b, /d\.text\.size\(\) <= 2000/); assert.match(b, /d\.text\.size\(\) >= 5/);
      assert.match(b, /d\.score is int && d\.score >= 0 && d\.score <= 10/);
      assert.match(b, /d\.contact\.size\(\) <= 120/); assert.match(b, /d\.shot\.size\(\) <= 250000/);
      assert.match(b, /d\.category in \['bug', 'idea', 'content', 'other'\]/);
      // tập khoá rules = tập khoá client (FKFeedback.validate) + createdAt
      const keys = (/hasOnly\(\[([^\]]+)\]\)/.exec(b) || [])[1].match(/'(\w+)'/g).map(s=> s.slice(1, -1)).sort();
      const cli = (/const ALLOWED = \[([^\]]+)\]/.exec(fb) || [])[1].match(/"(\w+)"/g).map(s=> s.slice(1, -1)).concat(["createdAt"]).sort();
      assert.deepEqual(keys, cli, "khoá rules ≠ khoá feedback.js");
      assert.ok(!/allow (read|list|get)[^;]*signedIn\(\)\s*;/.test(b), "người dùng thường không được đọc góp ý");
      assert.equal((nc.match(/\{/g) || []).length, (nc.match(/\}/g) || []).length, "ngoặc không cân");
      // admin.js: mục Góp ý & NPS theo quyền support.tickets; liên hệ cần users.pii
      const adm = read("admin.js");
      assert.match(adm, /registerSection\(\{ id:"support",[^}]*perms:\["support\.tickets"\][\s\S]{0,80}if\(A\.supTab === "feedback"\) return renderFeedbackPanel\(el\);/);
      assert.match(adm, /async function renderFeedbackPanel\(el\)\{\s*if\(!can\("support\.tickets"\)\)/);
      assert.match(adm, /can\("users\.pii"\) \? `<p class="adm-dim">Liên hệ/);
    });

    t.test("Bảng quản trị: Hỗ trợ khách hàng → thẻ 'Góp ý & NPS' vẽ được (KPI NPS, phân bố 0–10, lọc), escape nội dung", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      assert.ok(app.ev(`TE_ADMIN.sections.some(s=> s.id === "support" && s.perms.includes("support.tickets"))`));
      assert.ok(!app.ev(`TE_ADMIN.sections.some(s=> s.id === "feedback")`), "không thêm mục mới vào thanh bên");
      app.run(`localStorage.setItem("fitkit_cloud_demo_feedback", JSON.stringify([
        { id:"f1", kind:"nps", score:10, status:"new", v:1, appVersion:"2.0.0", createdAt: Date.now() },
        { id:"f2", kind:"nps", score:3, status:"new", v:1, appVersion:"2.0.0", createdAt: Date.now(), text:"<img src=x onerror=alert(1)>" },
        { id:"f3", kind:"feedback", category:"bug", text:"Lỗi khi lưu", status:"new", v:1, appVersion:"2.0.0", createdAt: Date.now(), shot:"javascript:alert(1)" } ]))`);
      app.run(`globalThis.__can = TE_RBAC.can; TE_RBAC.can = p=> p === "support.tickets";`);
      const el = app.run(`(()=>{ const el = document.createElement("div"); el.id = "adm-fb-test"; return el; })()`);
      app.run(`TE_ADMIN._A.supTab = "feedback"`);
      await app.ev(`TE_ADMIN.sections.find(s=> s.id === "support").render(document.getElementById("adm-fb-test"))`);
      const h = app.lastHtml("adm-fb-test");
      app.run(`TE_RBAC.can = __can;`);
      assert.match(h, /NPS 90 ngày/); assert.match(h, /<b>0<\/b>/, "NPS (1 ủng hộ, 1 phản đối) = 0");
      assert.match(h, /adm-nps-bars/); assert.match(h, /data-adm="fb-kind"/); assert.match(h, /data-adm="fb-st"/); assert.match(h, /data-adm="sup-tab"/);
      assert.ok(!/<img src=x/.test(h), "nội dung góp ý phải được escape");
      assert.ok(!/href="javascript:/.test(h), "ảnh chụp không hợp lệ không được chèn");
      void el;
    });

    /* ---------------- 6. ONBOARDING ---------------- */
    t.test("Onboarding: bộ đếm 'Bước x/5' + progressbar aria; lỗi rõ từng ô (aria-invalid); Enter = Tiếp tục; ô số mở bàn phím số + nhãn for=", async ()=>{
      const app = await t.app({ state:{ onboarded:false, authDone:true, health: HEALTH_DONE } });
      app.run(`openOnboarding(false)`);
      app.run(`showObStep(2)`);
      assert.equal(app.dom.registry.get("onboard-count").textContent, "Bước 3/5 · Chiều cao & cân nặng");
      const pg = app.dom.registry.get("onboard-progress");
      assert.equal(pg.getAttribute("role"), "progressbar"); assert.equal(pg.getAttribute("aria-valuenow"), "3"); assert.equal(pg.getAttribute("aria-valuemax"), "5");
      app.dom.registry.get("in-height").value = "40"; app.dom.registry.get("in-weight").value = "70";
      app.dom.registry.get("onboard-next").click();
      assert.equal(app.ev("obStep"), 2, "dữ liệu sai vẫn qua bước");
      assert.match(app.dom.registry.get("ob-err-2").textContent, /Chiều cao từ 80 đến 250 cm/);
      assert.equal(app.dom.registry.get("in-height").getAttribute("aria-invalid"), "true");
      app.dom.registry.get("in-height").value = "170";
      app.dom.registry.get("onboard-next").click();
      assert.equal(app.ev("obStep"), 3);
      assert.equal(app.dom.registry.get("ob-err-2").textContent, "");
      // giá trị mặc định hợp lý: vận động nhẹ, phòng gym, 3 buổi
      assert.deepEqual(app.evj("[tempProfile.activity, tempProfile.equipment, tempProfile.days]"), ["light", "gym", 3]);
      assert.equal(app.ev("validateStep(3)"), true);
      // bước 1: thiếu giới tính → thông báo riêng
      app.run(`tempProfile.gender = undefined; showObStep(1)`);
      app.dom.registry.get("in-age").value = "25";
      app.dom.registry.get("onboard-next").click();
      assert.match(app.dom.registry.get("ob-err-1").textContent, /Chọn giới tính/);
      // HTML: nhãn + bàn phím số + enterkeyhint
      for(const [id, mode] of [["in-age","numeric"], ["in-height","numeric"], ["in-weight","decimal"], ["in-bodyfat","decimal"]]){
        assert.match(html, new RegExp(`<label for="${id}">`), "thiếu label for=" + id);
        assert.match(html, new RegExp(`id="${id}"[^>]*inputmode="${mode}"`), id + " chưa có inputmode=" + mode);
        assert.match(html, new RegExp(`id="${id}"[^>]*enterkeyhint="next"`));
      }
      assert.match(html, /id="in-name"[^>]*autocomplete="given-name"/);
      assert.match(html, /<p class="ob-err" id="ob-err-1" role="alert"><\/p>/);
      assert.match(appJs, /addEventListener\("submit", e=>\{ e\.preventDefault\(\); \$\("#onboard-next"\)\.click\(\); \}\)/);
      assert.match(html, /id="days-list"[^>]*aria-labelledby="days-h"/); assert.match(html, /id="equip-list" aria-labelledby="equip-h"/);
    });

    t.test("Sửa câu trả lời từ Hồ sơ: mở đúng dữ liệu cũ, 'Quay lại' ở bước đầu về Hồ sơ (không về màn chào), nút cuối 'Lưu thay đổi'", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, health: HEALTH_DONE, profile:{ name:"An", gender:"female", age:30, height:160, weight:55, activity:"light", goal:"lose", level:"beginner", equipment:"home", daysPerWeek:4, autoTargets:true } } });
      app.run(`globalThis.__welcome = 0; const _sa = showAuth; showAuth = function(v){ if(v === "welcome") __welcome++; return _sa.apply(this, arguments); };`);
      app.run(`openOnboarding(true)`);
      assert.deepEqual(app.evj("[obEditMode, tempProfile.equipment, tempProfile.days, tempProfile.goal]"), [true, "home", 4, "lose"]);
      app.run(`showObStep(4)`);
      assert.equal(app.dom.registry.get("onboard-next").textContent, "Lưu thay đổi");
      app.run(`showObStep(0)`);
      app.dom.registry.get("onboard-back").click();
      assert.equal(app.ev("__welcome"), 0, "sửa hồ sơ mà Quay lại đưa về màn chào");
      assert.ok(!app.ev(`document.getElementById("onboarding").classList.contains("open")`));
      assert.ok(app.ev(`document.getElementById("screen-profile").classList.contains("active")`), "phải về Hồ sơ");
      assert.equal(app.ev("state.profile.goal"), "lose", "huỷ sửa không được đổi dữ liệu");
      // mở thẳng bước Mục tiêu (từ màn kế hoạch)
      app.run(`openOnboarding(true, 4)`);
      assert.equal(app.ev("obStep"), 4);
      app.run(`tempProfile.goal = "maintain"; finishOnboarding();`);
      assert.equal(app.ev("state.profile.goal"), "maintain");
      assert.equal(app.ev("state.profile.daysPerWeek"), 4); assert.equal(app.ev("state.profile.equipment"), "home");
    });

    t.test("Nơi tập / số buổi → giáo án gợi ý: tại nhà → tối thiểu dụng cụ; trung bình nhưng ≤ 3 buổi → Full Body; nâng cao ≤ 4 buổi → Power-building", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      const tpl = p=> app.ev(`(fkDefaultTemplate(${JSON.stringify(p)}, null) || {}).id || null`);
      assert.equal(tpl({ gender:"male", level:"beginner", age:27, equipment:"home" }), "tpl-u-home");
      assert.equal(tpl({ gender:"female", level:"beginner", age:27, equipment:"none", daysPerWeek:5 }), "tpl-f-home");
      assert.equal(tpl({ gender:"male", level:"intermediate", age:27, equipment:"gym", daysPerWeek:3 }), "tpl-m-fb");
      assert.equal(tpl({ gender:"male", level:"intermediate", age:27, equipment:"gym", daysPerWeek:4 }), "tpl-m-ul");
      assert.equal(tpl({ gender:"female", level:"advanced", age:27, equipment:"gym", daysPerWeek:4 }), "tpl-f-pb");
      assert.equal(tpl({ gender:"male", level:"advanced", age:27 }), null, "chưa khai số buổi → giữ cách cũ");
    });

    t.test("Màn 'Kế hoạch đã sẵn sàng': số liệu từ CHÍNH calcBMR/calcTDEE/calcMacros/nuWaterGoal (không lặp công thức), tuần đầu, CTA 'Bắt đầu buổi đầu tiên'", async ()=>{
      const src = fnBody(appJs, "fkPlanSummary");
      assert.ok(src, "thiếu fkPlanSummary");
      for(const f of ["calcBMR(", "calcTDEE(", "calcGoalKcal(", "calcMacros(", "nuWaterGoal("]) assert.ok(src.includes(f), "fkPlanSummary không dùng " + f);
      assert.ok(!/6\.25|10\s*\*\s*p\.weight|\* *0\.035|kcalAdjust|161/.test(src), "fkPlanSummary lặp lại công thức");
      assert.ok(!/6\.25|\b161\b/.test(fnBody(appJs, "showPlanReady")), "showPlanReady lặp lại công thức");
      const app = await t.app({ state:{ onboarded:false, authDone:true, health: HEALTH_DONE } });
      app.setNow("2026-11-11T09:00");     // thứ Tư
      app.run(`openOnboarding(false); tempProfile = Object.assign(tempProfile, { gender:"male", activity:"moderate", goal:"lose", level:"beginner", equipment:"gym", days:3 });
        document.getElementById("in-name").value = "Thắng"; document.getElementById("in-age").value = "30";
        document.getElementById("in-height").value = "175"; document.getElementById("in-weight").value = "80"; finishOnboarding();`);
      assert.ok(app.ev(`document.getElementById("ob-ready").classList.contains("open")`), "chưa hiện màn kế hoạch");
      const S = app.evj("fkPlanSummary()"), P = app.evj("state.profile");
      assert.equal(S.bmr, app.ev("calcBMR(state.profile)"));
      assert.equal(S.bmr, Math.round(10*80 + 6.25*175 - 5*30 + 5), "BMR Mifflin-St Jeor");
      assert.equal(S.tdee, P.tdee); assert.equal(S.kcal, P.goalKcal);
      assert.deepEqual([S.protein, S.carbs, S.fat], [P.protein, P.carbs, P.fat]);
      assert.equal(S.water, app.ev("nuWaterGoal(state.profile)"));
      assert.ok(S.deltaKcal < 0, "giảm mỡ → thâm hụt");
      assert.equal(S.days.length, 7); assert.ok(S.trainDays >= 2 && S.trainDays <= 4, "người mới 3 buổi: " + S.trainDays);
      assert.ok(S.first && S.first.n > 0, "phải có buổi đầu tiên");
      const h = app.lastHtml("ob-ready-body"), foot = app.lastHtml("ob-ready-foot");
      assert.match(h, /Kế hoạch của Thắng đã sẵn sàng/);
      assert.ok(h.includes(S.bmr.toLocaleString("vi-VN")) && h.includes(S.kcal.toLocaleString("vi-VN")), "thiếu BMR / kcal");
      assert.match(h, /BMR · nghỉ ngơi/); assert.match(h, /TDEE · cả ngày/); assert.match(h, /Đạm/); assert.match(h, /Tuần đầu tiên/);
      assert.match(h, /data-ob-edit="4"/, "thiếu nút sửa câu trả lời");
      assert.match(foot, /id="ob-ready-go"[^>]*>[\s\S]*Bắt đầu buổi đầu tiên/);
      assert.match(html, /<div id="ob-ready" class="ob-ready" role="dialog" aria-modal="true" aria-labelledby="ob-ready-h" hidden>/);
      // CTA → vào Tập luyện, chọn buổi đầu, mở buổi tập
      app.dom.registry.get("ob-ready-go").click();
      await app.settle(300);
      assert.ok(!app.ev(`document.getElementById("ob-ready").classList.contains("open")`));
      assert.equal(app.ev("state.selectedDay"), S.first.key);
      assert.ok(app.ev(`document.getElementById("screen-workout").classList.contains("active")`), "CTA phải vào màn Tập luyện");
      assert.ok(app.ev("!!session") || /Tập buổi/.test(app.lastHtml("sheet-content")), "CTA phải mở buổi tập (hoặc hỏi tập bù)");
    });

    t.test("Onboarding cũ không vỡ: OB_STEPS = 5, stepper 3 chặng còn, sàng lọc sức khoẻ vẫn chen trước khi hoàn tất", async ()=>{
      const app = await t.app({ state:{ onboarded:false, authDone:true } });
      assert.equal(app.ev("OB_STEPS"), 5);
      app.run(`obStep = 2; renderOnboardProgress()`);
      assert.match(app.lastHtml("sig-stepper"), /sig-step on" aria-current="step">.*Cơ thể/);
      // chưa làm sàng lọc → finishOnboarding mở sàng lọc trước, CHƯA onboard
      app.run(`openOnboarding(false); tempProfile = Object.assign(tempProfile, { gender:"female", goal:"maintain", level:"beginner" });
        document.getElementById("in-age").value = "27"; document.getElementById("in-height").value = "160"; document.getElementById("in-weight").value = "55"; finishOnboarding();`);
      assert.equal(app.ev("state.onboarded"), false, "phải qua sàng lọc sức khoẻ trước");
      assert.ok(!app.ev(`document.getElementById("ob-ready").classList.contains("open")`));
    });

    /* ---------------- 7. ĐÓNG GÓI ---------------- */
    t.test("CSP hợp lệ: thêm tối thiểu host thống kê (GA/Firebase, PostHog EU), không unsafe-eval / http: / '*' trần", ()=>{
      const m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html);
      assert.ok(m, "thiếu CSP");
      const dirs = {};
      m[1].split(";").map(s=> s.trim()).filter(Boolean).forEach(d=>{ const [k, ...v] = d.split(/\s+/); assert.ok(/^[a-z-]+$/.test(k), "chỉ thị lạ: " + k); assert.ok(!(k in dirs), "lặp chỉ thị " + k); dirs[k] = v; });
      for(const k of ["default-src","script-src","connect-src","object-src","base-uri","frame-src","img-src"]) assert.ok(dirs[k], "thiếu " + k);
      assert.deepEqual(dirs["object-src"], ["'none'"]); assert.deepEqual(dirs["base-uri"], ["'self'"]);
      assert.ok(!m[1].includes("unsafe-eval"));
      const all = Object.values(dirs).flat();
      expectNone(all.filter(v=> v === "*" || /^http:/.test(v)), "nguồn quá rộng / không HTTPS");
      expectNone(all.filter(v=> !/^('[\w-]+'|https:|data:|blob:|https:\/\/[\w*.-]+(\/[\w./-]*)?|wss:\/\/[\w*.-]+)$/.test(v)), "nguồn sai cú pháp");
      for(const h of ["https://www.googletagmanager.com", "https://eu-assets.i.posthog.com"]) assert.ok(dirs["script-src"].includes(h), "script-src thiếu " + h);
      for(const h of ["https://*.google-analytics.com", "https://eu.i.posthog.com"]) assert.ok(dirs["connect-src"].includes(h), "connect-src thiếu " + h);
      assert.ok(!dirs["script-src"].some(v=> /us(-assets)?\.i\.posthog/.test(v)), "chỉ thêm host EU (tối thiểu)");
      assert.ok(dirs["script-src"].includes("https://cdnjs.cloudflare.com"), "giữ cdnjs (JSZip)");
    });

    t.test("Đóng gói: sw.js ASSETS + cache ≥ v21, prepare-www.sh chép analytics.js/feedback.js, thứ tự nạp; không có khoá thật", ()=>{
      const sw = read("sw.js"), sh = read("scripts/prepare-www.sh");
      new Function(sw);
      const assets = [...(/const ASSETS = \[([\s\S]*?)\];/.exec(sw)[1]).matchAll(/"\.\/([^"]+)"/g)].map(x=> x[1]);
      for(const f of ["analytics.js", "feedback.js"]){
        assert.ok(assets.includes(f), "sw.js ASSETS thiếu " + f);
        assert.ok(new RegExp(`\\b${f.replace(".", "\\.")}\\b`).test(sh), "prepare-www.sh thiếu " + f);
        assert.ok(fs.existsSync(path.join(ROOT, f)));
      }
      assert.ok(Number((/const CACHE = "fitkit-v(\d+)"/.exec(sw) || [])[1]) >= 21, "tăng phiên bản cache (≥ v21)");
      const order = [...html.matchAll(/<script src="([^"]+)"/g)].map(x=> x[1]);
      const i = f=> order.indexOf(f);
      assert.ok(i("rbac.js") < i("analytics.js") && i("analytics.js") < i("data.js") && i("analytics.js") < i("app.js"), "analytics.js phải nạp sau rbac.js, trước data.js/app.js");
      assert.equal(order[order.length - 1], "health-safety.js", "health-safety.js luôn cuối");
      assert.equal(order[i("admin.js") + 1], "feedback.js", "feedback.js ngay sau admin.js");
      assert.equal(order[order.length - 2], "morph-icons.js", "morph-icons.js vẫn ngay trước health-safety.js");
      // không khoá thật trong mã / tài liệu
      const cfg = read("media-config.js"), fbc = read("firebase-config.js"), doc = read("docs/ANALYTICS.md");
      assert.match(cfg, /posthogKey: "",/); assert.match(fbc, /measurementId: "",/);
      [an, fb, cfg, fbc, doc, read("docs/FEEDBACK.md")].forEach(s=>{ assert.ok(!/phc_[A-Za-z0-9]{20,}/.test(s), "có khoá PostHog thật"); assert.ok(!/G-[A-Z0-9]{8,}/.test(s), "có measurementId thật"); });
    });

    t.test("Tài liệu & chính sách: docs/ANALYTICS.md có từ điển sự kiện + cách thêm khoá; docs/FEEDBACK.md; privacy-policy công bố thống kê & góp ý", ()=>{
      const doc = read("docs/ANALYTICS.md"), fdoc = read("docs/FEEDBACK.md"), pp = read("privacy-policy.html");
      for(const e of ["app_open","onboarding_step_view","onboarding_step_complete","onboarding_finish","signup","login","plan_created","workout_start","set_logged",
        "workout_finish","meal_logged","recipe_view","pt_profile_view","pt_contact","theme_change","share","feedback_submitted","nps_submitted"])
        assert.ok(doc.includes("`" + e + "`"), "ANALYTICS.md thiếu sự kiện " + e);
      assert.match(doc, /posthogKey/); assert.match(doc, /measurementId/); assert.match(doc, /Do Not Track/);
      assert.match(fdoc, /support\.tickets/); assert.match(fdoc, /Anonymous/); assert.match(fdoc, /90 ngày/);
      for(const kw of ["Thống kê sử dụng ẩn danh", "mặc định", "PostHog", "Firebase", "Góp ý", "băm một chiều", "Do Not Track", "13/11/2026"]) assert.ok(pp.includes(kw), "privacy-policy thiếu: " + kw);
      assert.ok(!/không dùng công cụ phân tích hành vi/.test(pp), "chính sách còn câu 'không dùng công cụ phân tích' — mâu thuẫn");
    });
  },
};

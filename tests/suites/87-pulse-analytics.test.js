/* Mục "Phân tích" của bảng quản trị: pulse.js (nhịp sử dụng ẩn danh) · admin-analytics.js · functions/analytics.js · firestore.rules */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");

function sandbox(opts){
  opts = opts || {};
  const store = Object.assign({}, opts.ls || {});
  const W = {
    localStorage: { getItem: k=> (k in store ? store[k] : null), setItem: (k, v)=>{ store[k] = String(v); }, removeItem: k=>{ delete store[k]; } },
    navigator: Object.assign({ language: "vi-VN" }, opts.nav || {}),
    location: { search: opts.search || "", hostname: "app.test" },
    cloud: { mode: "demo", user: opts.user || null },
    FK_I18N: { lang: opts.lang || "vi" },
    setTimeout, clearTimeout, setInterval: ()=> 0, Promise, URLSearchParams, URL, Date, Math, JSON,
  };
  W.window = W; W.globalThis = W; W._store = store;
  new Function("window", "globalThis", "FK_FEATURES", read("pulse.js").replace('typeof window !== "undefined" ? window : globalThis', "window"))(W, W, opts.features);
  return W;
}
const T0 = Date.UTC(2026, 10, 15, 3, 0, 0);          // 15/11/2026 10:00 giờ VN

module.exports = {
  name: "Phân tích quản trị — nhịp sử dụng ẩn danh & số liệu (pulse + admin-analytics)",
  area: "pulse.js, admin-analytics.js, functions/analytics.js, firestore.rules, analytics.js, index.html, sw.js",
  define(t){
    t.test("PULSE-01: ngày/tuần/tháng tính theo giờ Việt Nam", ()=>{
      const P = sandbox().FKPulse;
      assert.equal(P.day(Date.UTC(2026, 10, 14, 17, 30)), "2026-11-15", "00:30 giờ VN đã sang ngày mới");
      assert.equal(P.day(Date.UTC(2026, 10, 14, 16, 59)), "2026-11-14");
      assert.equal(P.week(T0), "2026-11-09", "tuần bắt đầu thứ Hai");
      assert.equal(P.month(T0), "2026-11");
    });
    t.test("PULSE-02: nhãn người mới / người quay lại / giữ chân / tính năng — không chứa uid hay email", ()=>{
      const W = sandbox({ search: "?utm_source=TikTok", user: { uid: "UID_SECRET_123", email: "a@b.vn" } }), P = W.FKPulse;
      const st = P.state();
      assert.match(st.vid, /^v[a-z0-9]{20}$/); assert.equal(st.src, "tiktok");
      st.first = "2026-11-15";
      const a = P.tagsFor(T0, st, { p: "web", l: "vi", a: true, feats: { workout: 1, hack: 1 } });
      assert.deepEqual(a.D, ["d:2026-11-15", "d:2026-11-15|p:web", "d:2026-11-15|l:vi", "d:2026-11-15|a:1", "n:2026-11-15", "n:2026-11-15|s:tiktok", "n:2026-11-15|p:web", "d:2026-11-15|f:workout", "n:2026-11-15|f:workout"]);
      assert.deepEqual(a.W, ["w:2026-11-09", "w:2026-11-09|p:web"]); assert.deepEqual(a.M, ["m:2026-11", "m:2026-11|p:web"]);
      st.first = "2026-11-08";
      const b = P.tagsFor(T0, st, { p: "ios", l: "en", a: false, feats: {} });
      assert.ok(b.D.includes("d:2026-11-15|ret") && b.D.includes("r:2026-11-08>7") && !b.D.some(x=> x.startsWith("n:")) && !b.D.includes("d:2026-11-15|a:1"));
      st.first = "2026-09-01";
      assert.ok(!P.tagsFor(T0, st, { p: "web", l: "vi", a: false, feats: {} }).D.some(x=> x.startsWith("r:")), "quá 30 ngày: không gắn nhãn giữ chân");
      assert.ok(!JSON.stringify([a, b]).includes("UID_SECRET") && !JSON.stringify(W._store).includes("UID_SECRET") && !JSON.stringify(W._store).includes("a@b.vn"));
    });
    t.test("PULSE-03: tôn trọng từ chối — consent 'denied', Do Not Track, GPC, FK_FEATURES.metrics=false, trình duyệt tự động", ()=>{
      assert.equal(sandbox().FKPulse.enabled(), true, "mặc định (chưa hỏi) được đếm ẩn danh");
      assert.equal(sandbox({ ls: { fk_analytics_v1: JSON.stringify({ consent: "denied" }) } }).FKPulse.enabled(), false);
      assert.equal(sandbox({ ls: { fk_analytics_v1: JSON.stringify({ consent: "granted" }) } }).FKPulse.enabled(), true);
      assert.equal(sandbox({ nav: { doNotTrack: "1" } }).FKPulse.enabled(), false);
      assert.equal(sandbox({ nav: { globalPrivacyControl: true } }).FKPulse.enabled(), false);
      assert.equal(sandbox({ features: { metrics: false } }).FKPulse.enabled(), false);
      assert.equal(sandbox({ nav: { webdriver: true } }).FKPulse.enabled(), false);
    });
    t.test("PULSE-04: demo — beat() ghi presence + activity trên máy; từ chối thì không ghi gì; nhãn không gửi lặp", async ()=>{
      const W = sandbox(), P = W.FKPulse;
      assert.equal(await P.beat(true), true);
      const s = P.demoStore(), vid = P.state().vid;
      assert.deepEqual(Object.keys(s.presence), [vid]);
      assert.deepEqual(Object.keys(s.presence[vid]).sort(), ["a", "l", "p", "s", "ts"]);
      const ids = Object.keys(s.activity).sort();
      assert.equal(ids.length, 3); assert.ok(ids.every(id=> /^[dwm]_[0-9-]{7,10}_v[a-z0-9]{20}$/.test(id)), "mã tài liệu khớp firestore.rules");
      const n0 = s.activity[ids[0]].t.length;
      await P.sync(Date.now());
      assert.equal(P.demoStore().activity[ids[0]].t.length, n0);
      P.mark("workout_start"); P.mark("screen_view", { screen: "shop" }); await P.sync(Date.now());
      const d = P.demoStore().activity[ids[0]].t;
      assert.ok(d.some(x=> x.endsWith("|f:workout")) && d.some(x=> x.endsWith("|f:shop")));
      assert.ok(d.length <= 40, "≤ 40 nhãn (giới hạn rules)");
      const W2 = sandbox({ ls: { fk_analytics_v1: JSON.stringify({ consent: "denied" }) } });
      assert.equal(await W2.FKPulse.beat(true), false); assert.ok(!("fk_pulse_demo" in W2._store));
    });
    t.test("PULSE-05: analytics.js gọi FKPulse.mark trước khi xét đồng ý, chỉ chuyển tên sự kiện / tên màn hình", ()=>{
      const an = read("analytics.js");
      const i = an.indexOf("function track(event, props){"), body = an.slice(i, i + 600);
      assert.ok(body.indexOf("G.FKPulse.mark(") > 0 && body.indexOf("G.FKPulse.mark(") < body.indexOf("if(!consent())"));
      assert.match(body, /event === "screen_view" \? \{ screen: props && props\.screen \} : null/);
    });
    const loadAdmin = ()=>{ const W = { TE_RBAC: { can: ()=> true }, cloud: { mode: "demo" } }; W.window = W;
      new Function("window", read("admin-analytics.js").replace('typeof window !== "undefined" ? window : globalThis', "window"))(W); return W.TE_ADMIN_ANALYTICS; };
    const loadFn = ()=>{
      const Module = require("module"), orig = Module._load;
      class HttpsError extends Error { constructor(code, message){ super(message); this.code = code; } }
      const trig = (o, h)=> h;
      const mocks = { "firebase-functions/v2/https": { onCall: (o, h)=>{ const f = r=> h(r); f.opts = o; return f; }, HttpsError },
        "firebase-functions/v2/firestore": { onDocumentCreated: trig, onDocumentWritten: trig },
        "firebase-functions/params": { defineSecret: ()=> ({ value: ()=> "" }), defineString: ()=> ({ value: ()=> "" }) },
        "firebase-functions/logger": { info(){}, warn(){}, error(){} }, "firebase-admin": { firestore: ()=> ({}), auth: ()=> ({}) } };
      Module._load = function(req){ if(mocks[req]) return mocks[req]; return orig.apply(this, arguments); };
      const dir = path.join(ROOT, "functions");
      ["analytics.js", "admin.js"].forEach(f=>{ try{ delete require.cache[require.resolve(path.join(dir, f))]; }catch(e){} });
      try{ return require(path.join(dir, "analytics.js")); } finally { Module._load = orig; }
    };
    t.test("ANALYTICS-01: wanted() ≤ 400 nhãn và mọi nhãn (kể cả nhãn pulse.js sinh ra) đều qua bộ lọc máy chủ", ()=>{
      const A = loadAdmin(), F = loadFn()._analyticsTest, tags = A.wanted(T0);
      assert.ok(tags.length <= F.MAX_TAGS, "số nhãn: " + tags.length);
      assert.equal(new Set(tags).size, tags.length);
      assert.deepEqual(F.cleanTags(tags), tags, "máy chủ nhận đủ mọi nhãn bảng quản trị hỏi");
      const P = sandbox({ search: "?utm_source=zalo" }).FKPulse, st = P.state(); st.first = "2026-11-15";
      const feats = {}; P.FEATURES.forEach(f=>{ feats[f] = 1; });
      const mine = P.tagsFor(T0, st, { p: "android", l: "en", a: true, feats });
      const all = mine.D.concat(mine.W, mine.M); st.first = "2026-11-01"; all.push.apply(all, P.tagsFor(T0, st, { p: "web", l: "vi", a: false, feats: {} }).D);
      all.forEach(x=> assert.ok(F.TAG_RE.test(x), "nhãn bị máy chủ từ chối: " + x));
      assert.ok(mine.D.length <= 40);
      assert.deepEqual(F.cleanTags(["d:2026-11-15", "d:2026-11-15", "x:1", "d:2026-11-15|f:<script>", 5, null, "users/abc"]), ["d:2026-11-15"]);
    });
    t.test("ANALYTICS-02: build() — DAU, người mới, tuần/tháng, giữ chân D1/D7, phễu, nguồn", ()=>{
      const A = loadAdmin(), c = {};
      c["d:2026-11-15"] = 50; c["d:2026-11-14"] = 40; c["n:2026-11-15"] = 10; c["d:2026-11-15|ret"] = 40; c["d:2026-11-15|a:1"] = 15;
      c["d:2026-11-15|p:web"] = 30; c["d:2026-11-15|p:android"] = 20; c["w:2026-11-09"] = 120; c["w:2026-11-02"] = 100; c["m:2026-11"] = 300; c["m:2026-10"] = 200;
      for(let i = 7; i <= 13; i++){ const d = `2026-11-${String(i).padStart(2, "0")}`; c["n:" + d] = 10; c[`r:${d}>1`] = 3; c["d:" + d] = 40; }
      c["n:2026-11-01"] = 20; c["r:2026-11-01>7"] = 4;
      c["n:2026-11-15|f:onboard"] = 8; c["n:2026-11-15|f:signup"] = 2; c["n:2026-11-15|s:facebook"] = 7; c["n:2026-11-15|s:direct"] = 3; c["d:2026-11-15|f:workout"] = 25;
      const M = A.build(c, T0);
      assert.equal(M.today, "2026-11-15"); assert.equal(M.days.length, 30); assert.equal(M.days[29].dau, 50); assert.equal(M.t.yest, 40); assert.equal(M.t.nu, 10);
      assert.deepEqual([M.wau.cur, M.wau.prev, M.mau.cur, M.mau.prev], [120, 100, 300, 200]);
      assert.equal(M.avg7, 40, "trung bình 7 ngày trọn (08–14/11), không tính hôm nay"); assert.equal(M.stick, 13.3);
      assert.deepEqual([M.ret.d1.base, M.ret.d1.back, M.ret.d1.rate], [70, 21, 30]);
      assert.deepEqual([M.ret.d7.base, M.ret.d7.back, M.ret.d7.rate], [30, 4, 13.3]);   // nhóm 01–07/11: 20 + 10 người mới
      assert.equal(M.ret.d30.rate, null);
      assert.equal(M.funnel[0].n, 60, "người mới 7 ngày (09–15/11)"); assert.equal(M.funnel[1].n, 8);
      assert.deepEqual(M.sources.map(x=> x.k), ["facebook", "direct"]);
      assert.equal(M.features[0].k, "workout");
      assert.ok(M.insights.some(i=> i.tone === "warn" && /Rơi nhiều nhất/.test(i.text)), "chỉ ra bước rơi nhiều nhất");
      const E0 = A.build({}, T0); assert.equal(E0.insights.length, 1); assert.match(E0.insights[0].text, /Chưa có dữ liệu/);
    });
    t.test("ANALYTICS-03: đang trực tuyến = nhịp trong 150 giây; nội dung lạ được escape khi vẽ", ()=>{
      const A = loadAdmin(), now = T0;
      const o = A.online([{ ts: now - 10000, p: "web", s: "home", a: true }, { ts: now - 149000, p: "ios", s: "<img src=x onerror=1>", a: false }, { ts: now - 151000, p: "web", s: "home", a: true }, null], now);
      assert.equal(o.n, 2); assert.equal(o.signed, 1); assert.deepEqual(o.plat.map(x=> x.k).sort(), ["ios", "web"]);
      const html = A.liveHtml(o, now);
      assert.ok(!html.includes("<img src=x") && html.includes("&lt;img"));
      assert.ok(!/<script/i.test(A.modelHtml(A.build({ "d:2026-11-15": 3 }, now))));
    });
    t.test("ANALYTICS-04: Cloud Function adminAnalytics — cần quyền analytics.view, chỉ đếm nhãn hợp lệ, lỗi đếm → 0", async ()=>{
      const F = loadFn()._analyticsTest, asked = [];
      const deps = role=> ({ actorOf: async ()=> ({ uid: "u1", role, px: [] }), count: async tag=>{ asked.push(tag); if(tag === "d:2026-11-14") throw new Error("x"); return 7; } });
      const r = await F.adminAnalyticsCore({ data: { tags: ["d:2026-11-15", "d:2026-11-14", "bad tag"] } }, deps("analyst"));
      assert.deepEqual(r.counts, { "d:2026-11-15": 7, "d:2026-11-14": 0 }); assert.deepEqual(asked.sort(), ["d:2026-11-14", "d:2026-11-15"]);
      await assert.rejects(()=> F.adminAnalyticsCore({ data: { tags: ["d:2026-11-15"] } }, deps("support")), e=> e.code === "permission-denied");
      await assert.rejects(()=> F.adminAnalyticsCore({ data: { tags: ["d:2026-11-15"] } }, deps(null)), e=> e.code === "permission-denied");
      await assert.rejects(()=> F.adminAnalyticsCore({ data: { tags: ["nope"] } }, deps("owner")), e=> e.code === "invalid-argument");
      assert.match(read("functions/index.js"), /require\("\.\/analytics"\)/);
    });
    t.test("ANALYTICS-05: firestore.rules — presence/activity khoá hình dạng, không ai đọc từng tài liệu; khoá khớp pulse.js", ()=>{
      const r = read("firestore.rules");
      const pres = r.slice(r.indexOf("match /presence/{vid}"), r.indexOf("match /activity/{id}"));
      const act = r.slice(r.indexOf("match /activity/{id}"), r.indexOf("match /activity/{id}") + 700);
      assert.match(pres, /allow get: if false;/); assert.match(pres, /allow list, delete: if hasPerm\('analytics\.view'\);/);
      assert.match(pres, /hasOnly\(\['ts', 'p', 's', 'l', 'a'\]\)/); assert.match(pres, /ts == request\.time/); assert.match(pres, /resource\.data\.ts\.toMillis\(\) \+ 20000/);
      assert.match(act, /allow read, delete: if false;/); assert.match(act, /hasOnly\(\['ts', 't'\]\)/); assert.match(act, /t\.size\(\) <= 40/); assert.match(act, /hasAll\(resource\.data\.t\)/);
      assert.match(r, /function okVid\(v\) \{ return v\.matches\('\^v\[a-z0-9\]\{20\}\$'\); \}/);
    });
    t.test("ANALYTICS-06: đóng gói — index.html, sw.js, prepare-www.sh, quyền mục, chính sách quyền riêng tư", ()=>{
      const html = read("index.html"), order = [...html.matchAll(/<script src="([^"]+)"/g)].map(m=> m[1]), at = f=> order.indexOf(f);
      assert.ok(at("feedback.js") < at("pulse.js") && at("pulse.js") < at("admin-analytics.js") && at("admin.js") < at("admin-analytics.js"));
      const sw = read("sw.js"); assert.ok(sw.includes('"./pulse.js"') && sw.includes('"./admin-analytics.js"'));
      assert.ok(+(/const CACHE = "fitkit-v(\d+)"/.exec(sw)[1]) >= 28);
      assert.match(read("scripts/prepare-www.sh"), /feedback\.js pulse\.js admin-analytics\.js/);
      assert.match(read("admin-analytics.js"), /id:"analytics", title:"Phân tích", icon:"adm_chart", order:15, perms:\["analytics\.view"\]/);
      assert.match(read("privacy-policy.html"), /id="pulse"/); assert.match(read("firebase-config.js"), /metrics: true/);
    });
  }
};

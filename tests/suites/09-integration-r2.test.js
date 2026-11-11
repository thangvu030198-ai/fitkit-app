/* Vòng tích hợp 2 (11/11/2026): PT Connect · Cộng đồng · Sự kiện · Gian hàng · thương hiệu · phân quyền · Trang chủ
   - đóng gói: sw.js (cache v5), prepare-www.sh (assets/brand, favicon, og), capacitor.config.json, favicon trong index.html
   - firestore.rules: gộp luật social + events, KHÔNG mở lỏng (list users, notes authorUid, học viên chỉ ghi trường của mình)
   - themes.js: bật fk-themed cho cả theme Mặc định; splash dùng lockup bản nền tối
   - hợp đồng phân quyền teCan(perm); API Trang chủ teHomeExplore.add({ id, title, icon, onClick, priority }) */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert, expectNone } = require("../lib/framework");
const { APP_DIR } = require("../lib/harness");

const read = f => fs.readFileSync(path.join(APP_DIR, f), "utf8");
const block = (src, head)=>{          // nội dung khối { … } ngay sau dòng chứa head (đếm ngoặc)
  const i = src.indexOf(head); if(i < 0) return "";
  let j = src.indexOf("{", i + head.length), d = 0, k = j;
  for(; k < src.length; k++){ if(src[k] === "{") d++; else if(src[k] === "}"){ d--; if(!d) break; } }
  return src.slice(j + 1, k);
};

module.exports = {
  name: "Tích hợp vòng 2: PT Connect, Cộng đồng, Sự kiện, Gian hàng, thương hiệu, phân quyền, Trang chủ",
  area: "Tích hợp vòng 2 (index.html, sw.js, prepare-www.sh, firestore.rules, capacitor, themes.js, pt.js, app.js)",
  async define(t){
    const app = await t.app({ settleMs: 150 });
    await app.settle(60);

    /* ---------- 1. Nạp module ---------- */
    t.test("6 module mới nạp không lỗi, API công khai sẵn sàng (cloud.social, TEConnect, TECommunity, cloudEvents, TapEv, TapShop)", ()=>{
      assert.deepEqual(app.loadErrors.map(e=> e.file + ": " + e.error.message), []);
      const ty = app.evj(`({ social: typeof (cloud.social), conn: typeof TEConnect, comm: typeof TECommunity, ce: typeof cloudEvents, ev: typeof TapEv, shop: typeof TapShop,
        evOpen: typeof (TapEv && TapEv.open), cart: typeof (TapShop && TapShop.openCart), engine: cloud.social && cloud.social.engine, ceMode: typeof cloudEvents !== "undefined" ? String(cloudEvents.mode) : "" })`);
      assert.deepEqual(ty, { social:"object", conn:"object", comm:"object", ce:"object", ev:"object", shop:"object", evOpen:"function", cart:"function", engine:"demo", ceMode:"demo" });
      const errs = app.consoleLog.filter(c=> c[0] === "error").map(c=> c[1]).concat(app.asyncErrors.map(e=> e.stack || String(e)));
      assert.deepEqual(errs, []);
    });
    t.test("Màn mới mở được không lỗi: Cộng đồng, Sự kiện (4 tab), giỏ hàng, kết nối PT", async ()=>{
      const bad = [];
      const tryRun = async (code)=>{ try{ app.run(code); await app.settle(40); }catch(e){ bad.push(`${code}: ${e.message}`); } };
      await tryRun(`goto("community")`);
      for(const tab of ["challenges", "events", "shop", "gifts"]) await tryRun(`TapEv.open(${JSON.stringify(tab)})`);
      await tryRun(`TapShop.openCart(); closeSheet()`);
      await tryRun(`goto("coach")`);
      await tryRun(`goto("home")`);
      assert.deepEqual(bad, []);
      assert.equal(app.asyncErrors.length, 0, app.asyncErrors.map(e=> e.message).join("; "));
      const html = app.dom.htmlLog.map(x=> x.html).join("\n");
      // fix-commerce vòng 2 (GLOSSARY §8.4): tab "Gian hàng" → "Cửa hàng"
      assert.ok(/Cộng đồng/.test(html) && /Thi đua/.test(html) && /Gian hàng|Cửa hàng/.test(html), "chưa render nội dung module mới");
    });

    /* ---------- 2. Đóng gói ---------- */
    t.test("sw.js: cache fitkit-v5+ (vòng 3: v6), đủ 6 JS + 4 CSS mới, favicon, lockup, logo-full", ()=>{
      const sw = read("sw.js");
      const ver = Number((/const CACHE = "fitkit-v(\d+)"/.exec(sw) || [])[1]);
      assert.ok(ver >= 5, "tên cache phải ≥ fitkit-v5 (đổi số mỗi lần thêm/bớt file)");
      for(const f of ["cloud-social.js","pt-connect.js","community.js","cloud-events.js","events.js","shop.js","pt-connect.css","community.css","events.css","shop.css",
        "assets/favicon.svg","assets/favicon-32.png","assets/brand/logo-lockup-light.svg","assets/brand/logo-lockup-dark.svg","assets/brand/logo-full.png"])
        assert.ok(sw.includes(`"./${f}"`), "sw.js thiếu " + f);
      const missing = [...sw.matchAll(/"\.\/([^"]+)"/g)].map(m=> m[1]).filter(f=> !fs.existsSync(path.join(APP_DIR, f)));
      expectNone(missing, "sw.js trỏ tới file không tồn tại");
    });
    t.test("prepare-www.sh: chép assets/brand (svg+png, bỏ source/), favicon, og-tapeasy.jpg; tự kiểm ảnh mà index/manifest/sw cần; dừng khi thiếu", ()=>{
      const sh = read("scripts/prepare-www.sh");
      assert.match(sh, /cp assets\/brand\/\*\.svg assets\/brand\/\*\.png www\/assets\/brand\//);
      assert.match(sh, /assets\/favicon\.svg assets\/favicon-32\.png assets\/favicon-16\.png assets\/favicon\.ico/);
      assert.match(sh, /assets\/og-tapeasy\.jpg/);
      assert.match(sh, /index\.html manifest\.json sw\.js/);
      assert.match(sh, /exit 1/);
      for(const f of ["cloud-social.js","pt-connect.js","community.js","cloud-events.js","events.js","shop.js","pt-connect.css","community.css","events.css","shop.css"])
        assert.ok(sh.split(/\s+/).includes(f), "prepare-www.sh thiếu " + f);
    });
    t.test("capacitor.config.json: nền #061A24 (khớp splash tối), icon thông báo teal #02BCB3; appId không đổi", ()=>{
      const c = JSON.parse(read("capacitor.config.json"));
      assert.equal(c.backgroundColor, "#061A24"); assert.equal(c.ios.backgroundColor, "#061A24"); assert.equal(c.android.backgroundColor, "#061A24");
      assert.equal(c.plugins.LocalNotifications.iconColor, "#02BCB3");
      assert.equal(c.appId, "vn.thangvu.fitkit"); assert.equal(c.appName, "TapEasy");
    });
    t.test("index.html: favicon SVG + PNG 32/16, apple-touch-icon 180, mọi ảnh trỏ tới file có thật", ()=>{
      const html = read("index.html");
      assert.match(html, /<link rel="icon" href="assets\/favicon\.svg" type="image\/svg\+xml">/);
      assert.match(html, /<link rel="icon" href="assets\/favicon-32\.png" type="image\/png" sizes="32x32">/);
      assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="assets\/apple-touch-icon-180\.png">/);
      const imgs = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map(m=> m[1]);
      expectNone(imgs.filter(f=> !fs.existsSync(path.join(APP_DIR, f))), "index.html trỏ ảnh không tồn tại");
    });

    /* ---------- 3. firestore.rules ---------- */
    t.test("firestore.rules: gộp social + events nhưng KHÔNG mở lỏng (list users cấm, notes ràng authorUid, học viên chỉ ghi trường của mình)", ()=>{
      const r = read("firestore.rules"), nc = r.replace(/\/\/[^\n]*/g, "");
      const users = block(nc, "match /users/{uid}");
      assert.match(users, /allow list: if false;/);
      assert.match(users, /allow get: if signedIn\(\) && \(me\(\) == uid \|\| resource\.data\.isPT == true\);/);
      assert.ok(!/allow read/.test(users), "users có allow read (gồm list)");
      assert.match(nc, /function validNote\(d\)[\s\S]*?d\.authorUid == me\(\)/);
      // vòng 3 (RBAC): quyền ghi sản phẩm = hasPerm('shop.products'); thêm đúng 1 chỗ đọc công khai: đánh giá PT (Tìm PT — minh bạch)
      const pub = nc.split("\n").filter(l=> /if true;/.test(l)).map(l=> l.trim());
      assert.deepEqual(pub, ["allow read: if true;", "match /products/{id} { allow read: if true; allow write: if hasPerm('shop.products'); }", "allow read: if true;"],
        "chỉ routines (bảng tin), products (gian hàng) và ptListings/*/reviews (đánh giá PT công khai) được đọc công khai");
      assert.match(block(nc, "match /routines/{rid}"), /allow read: if true;/);
      assert.match(block(nc, "match /reviews/{ruid}"), /allow read: if true;/, "đánh giá PT công khai");
      assert.ok(!/allow write: if signedIn\(\);/.test(nc), "có collection cho mọi người ghi tự do");
      // học viên chỉ ghi health/measurements/photos/chat/trainingSync
      assert.match(nc, /isStudent\(\)\s*&& request\.resource\.data\.studentUid == me\(\)\s*&& onlyKeys\(\['health', 'measurements', 'photos', 'chat', 'trainingSync', 'updatedAt'\]\)/);
      // admins: không ai tự ghi
      assert.match(nc, /match \/admins\/\{uid\} \{ allow get: if signedIn\(\) && me\(\) == uid; allow list, write: if false; \}/);
    });
    t.test("firestore.rules: chat — người gửi là chính mình + vai khớp form + kiểu tin hợp lệ + giới hạn chữ/ảnh; không sửa tin", ()=>{
      const m = block(read("firestore.rules").replace(/\/\/[^\n]*/g, ""), "match /messages/{mid}");
      assert.match(m, /request\.resource\.data\.from == me\(\)/);
      assert.match(m, /request\.resource\.data\.role == 'pt' && pc\(\)\.ptId == me\(\)/);
      assert.match(m, /request\.resource\.data\.role == 'student' && pc\(\)\.studentUid == me\(\)/);
      // fix-security QS-12: client chỉ gửi 'text' / 'image' — dòng "hệ thống"/"nhật ký" do Cloud Function (Admin SDK) ghi
      //   (trước: client gửi được kind 'system' → giả danh dòng hệ thống). Thêm: đúng bộ trường, tên không giả danh, người nhận chặn thì không gửi.
      assert.match(m, /kind in \['text', 'image'\]/);
      assert.doesNotMatch(m, /'system'\]/);
      assert.match(m, /keys\(\)\.hasOnly\(\['from', 'role', 'name', 'kind', 'text', 'img', 'meta', 'ts'\]\)/);
      assert.match(m, /!blockedBy\(peer\(\), me\(\)\)/);
      assert.match(m, /text\.size\(\) <= 2000/); assert.match(m, /img\.size\(\) <= 140000/);
      assert.match(m, /allow update: if false;/);
    });
    t.test("firestore.rules: lời mời theo email (token, chữ thường), routine đếm ±1 có đánh dấu, đăng ký sự kiện không tự đặt 'đã trả tiền', đơn hàng chỉ huỷ khi chưa xác nhận", ()=>{
      const nc = read("firestore.rules").replace(/\/\/[^\n]*/g, "");
      const inv = block(nc, "match /invites/{iid}");
      assert.match(inv, /myEmail\(\) != '' && resource\.data\.email == myEmail\(\)/);
      assert.match(inv, /onlyKeys\(\['status', 'respondedAt', 'studentUid', 'studentName'\]\)/);
      const rt = block(nc, "match /routines/{rid}");
      assert.match(rt, /dlt\('likes'\) == 1 && !exists\(mark\('likes'\)\) && existsAfter\(mark\('likes'\)\)/);
      assert.match(rt, /hasPerm\('community\.moderate'\) && onlyKeys\(\['approved', 'hidden', 'reports', 'updatedAt', 'moderatedBy', 'moderatedAt', 'modNote'\]\)/);
      const ev = block(nc, "match /events/{id}");
      assert.match(ev, /r\.get\('paid', false\) == false \|\| freeEvent\(\)/);
      assert.match(ev, /!\('checkinCode' in r\)/);
      // fix-security QC-08: học viên KHÔNG tự đổi 'checked_in' bằng mã chung nữa (mã lộ = ai cũng check-in, ngoài giờ) —
      //   check-in chỉ qua Cloud Function checkInEvent (khung giờ + mã băm / xoay vòng 60 giây + giới hạn tần suất)
      assert.doesNotMatch(ev, /checkinCode == get\(/);
      assert.doesNotMatch(ev, /request\.resource\.data\.status == 'checked_in'/);
      assert.match(ev, /allow update: if hasPerm\('events\.checkin'\)/);
      assert.match(nc, /match \/\{path=\*\*\}\/entries\/\{uid\} \{ allow read: if signedIn\(\) && \(resource\.data\.uid == me\(\) \|\| hasPerm\('challenges\.manage'\)\); \}/);
      const od = block(nc, "match /orders/{id}");
      assert.match(od, /resource\.data\.status in \['pending', 'awaiting_payment'\]\s*&& request\.resource\.data\.status == 'cancelled'/);
      assert.match(od, /allow delete: if false;/);
      // cân ngoặc
      const n = s=> (nc.match(new RegExp("\\" + s, "g")) || []).length;
      assert.equal(n("{"), n("}")); assert.equal(n("("), n(")")); assert.equal(n("["), n("]"));
    });

    /* ---------- 4. Thương hiệu ---------- */
    t.test("themes.js: theme Mặc định bật fk-themed (mint cứng → teal), ô mẫu Navy · Teal · Coral; theme khác giữ nguyên", ()=>{
      const src = read("themes.js");
      assert.match(src, /root\.classList\.toggle\("fk-themed", true\)/);
      assert.match(src, /\{ id:"navy",\s+name:"Mặc định",\s+desc:"Navy · Teal · Coral",\s+meta:"#061A24", sw:\["#061A24","#33D6C9","#FF7A45"\] \}/);
      for(const id of ["ocean","sunset","forest","midnight","light"]) assert.match(src, new RegExp(`id:"${id}"`));
      // lớp màu sinh tự động khớp style.css hiện tại (đã chạy lại gen_themes_layer.py --write)
      const th = read("themes.css");
      assert.match(th, /:where\(html\.fk-themed\) \.te-xp\{/);
      const tm = read("themes-modules.css");
      for(const f of ["pt-connect.css","community.css"]) assert.ok(tm.includes(`===== ${f}`), "themes-modules.css thiếu " + f);
    });
    t.test("Splash nền tối dùng logo-lockup-light.svg (theme Sáng: lockup-dark); không còn logo-full.png trên nền tối", ()=>{
      const a = app.dom.htmlLog.map(x=> x.html).filter(h=> /class="splash"/.test(h)).pop() || "";
      assert.match(a, /class="splash-logo on-dark" src="assets\/brand\/logo-lockup-light\.svg" alt="TapEasy"/);
      assert.match(a, /class="splash-logo on-light" src="assets\/brand\/logo-lockup-dark\.svg"/);
      assert.match(read("style.css"), /html\.fk-light \.splash-brand img\.on-dark\{ display:none; \}/);
    });

    /* ---------- 5. Phân quyền ---------- */
    // INTEGRATION-admin.md §8: với rbac.js, state.isAdmin không gán tay được nữa (đó chính là mục tiêu) → hợp đồng mới
    t.test("teCan(perm): dùng TE_RBAC.can; state.isAdmin không cấp được quyền", ()=>{
      assert.equal(app.ev(`typeof teCan`), "function");
      app.run(`window.__rb = window.TE_RBAC; state.isAdmin = true;`);
      assert.equal(app.ev(`teCan("events.manage")`), false, "gán state.isAdmin không cấp quyền");
      app.run(`window.TE_RBAC = { can: p=> p === "shop.orders" };`);
      assert.equal(app.ev(`teCan("shop.orders")`), true);
      assert.equal(app.ev(`teCan("events.manage")`), false);
      app.run(`window.TE_RBAC = { can(){ throw new Error("x"); } };`);
      assert.equal(app.ev(`teCan("events.manage")`), false, "RBAC lỗi → lõi rbac.js, không quay về cờ cục bộ");
      app.run(`window.TE_RBAC = window.__rb;`);
    });

    /* ---------- 6. Trang chủ: Khám phá ---------- */
    t.test("Trang chủ: hàng 'Khám phá' thay lưới lối vào + hàng lối tắt cũ; ô của module (Cộng đồng, Giáo án riêng, Thi đua, Gian hàng)", async ()=>{
      app.call("goto", "home"); await app.settle(30);
      const h = app.lastHtml("home-content");
      assert.match(h, /<section class="te-explore" id="te-explore" aria-label="Khám phá"/);
      assert.ok(!/class="entry-grid"|class="quick-row"|Bạn muốn làm gì\?/.test(h), "còn lưới lối vào cũ (trùng thanh dưới + hero)");
      const ids = app.evj("teHomeExplore.list().map(x=> x.id)");
      // vòng 3: 7 ô gọn — Kết nối (Tìm PT · Cộng đồng · Sự kiện · Kho kiến thức · Gian hàng) rồi Giáo án (riêng · mẫu)
      assert.deepEqual(ids, ["findpt","community","events","kb","shop","builder","templates"], ids.join(","));
      assert.match(h, /class="home-pt"|class="card home-reminders"/);
    });
    t.test("teHomeExplore.add/remove: ưu tiên lớn đứng trước, cùng id thay thế, when=false ẩn, chữ được escape, onClick chạy qua open()", ()=>{
      app.run(`globalThis.__kbReal = teHomeExplore.list().find(x=> x.id === "kb") || null;`);   // ô thật của kb.js — khôi phục cuối test
      app.run(`globalThis.__hit = []; teHomeExplore.add({ id:"kb", title:"Kho <b>kiến thức</b>", sub:'"x" & y', icon:"menu_book", priority:99, onClick: ()=> __hit.push("kb") });`);
      assert.equal(app.evj("teHomeExplore.list()[0].id"), "kb");
      const html = app.ev("teHomeExplore.html()");
      assert.ok(html.includes("Kho &lt;b&gt;kiến thức&lt;/b&gt;") && html.includes("&quot;x&quot; &amp; y") && !/<b>kiến/.test(html), html.slice(0, 300));
      app.run(`teHomeExplore.add({ id:"kb", title:"Kho kiến thức", icon:"bad\\"><img src=x>", priority:10, onClick: ()=> __hit.push("kb2") });`);
      const L = app.evj("teHomeExplore.list().map(x=> x.id)");
      assert.equal(L.filter(x=> x === "kb").length, 1, "trùng id phải thay thế");
      assert.ok(L.indexOf("kb") > L.indexOf("templates"), "priority 10 phải đứng sau templates (60)");
      assert.ok(!/<img src=x>/.test(app.ev("teHomeExplore.html()")), "tên icon không được chèn HTML");
      assert.equal(app.ev(`teHomeExplore.open("kb")`), true); assert.deepEqual(app.evj("__hit"), ["kb2"]);
      app.run(`teHomeExplore.add({ id:"hidden-x", title:"Ẩn", when: ()=> false, onClick(){} })`);
      assert.ok(!app.evj("teHomeExplore.list().map(x=> x.id)").includes("hidden-x"));
      app.run(`teHomeExplore.remove("kb"); teHomeExplore.remove("hidden-x");`);
      assert.ok(!app.evj("teHomeExplore.list().map(x=> x.id)").includes("kb"));
      app.run(`if(globalThis.__kbReal) teHomeExplore.add(__kbReal);`);
      assert.equal(app.ev(`typeof window.teHomeExplore.add`), "function");
    });
    t.test("Trang chủ không lỗi với mọi tổ hợp: chưa tập buổi nào / có buổi PT sắp tới / theme Sáng", async ()=>{
      app.run(`state.coachUpcoming = [{ cid:"c1", sid:"s1", role:"student", date:todayStr(new Date(Date.now()+86400000)), time:"10:00", title:"Chân", who:"PT An", mode:"online", before:60 }]; renderHomeScreen();`);
      await app.settle(20);
      assert.match(app.lastHtml("home-content"), /class="home-pt"/);
      app.run(`fkTheme.set("light"); renderHomeScreen(); fkTheme.set("navy");`);
      await app.settle(20);
      assert.equal(app.asyncErrors.length, 0, app.asyncErrors.map(e=> e.message).join("; "));
    });
  },
};

/* Vòng tích hợp 3 (11/11/2026): Quản trị & phân quyền (rbac/cloud-admin/admin) · Tìm PT · Kho kiến thức · ảnh/clip sự kiện
   - index.html: thứ tự nạp theo docs/INTEGRATION-admin.md · INTEGRATION-findpt.md · INTEGRATION-kb.md · INTEGRATION-events-shop.md §10
   - đóng gói: sw.js (fitkit-v6), prepare-www.sh (mọi file mới + assets/shop/*.webp), firebase.json (storage + indexes)
   - firestore.rules gộp admin + findpt + events §10.6 + kb — KHÔNG mở lỏng; storage.rules; Cloud Functions mới
   - teCan ở module (events/shop/community/findpt/kb), voucher toàn hệ thống (§6.2), chặn Owner tự xoá tài khoản (§6.6)
   - Trang chủ: hàng Khám phá 7 ô; menu ☰ nhóm theo khu vực
   - (nếu có trong máy) bộ kiểm thử lõi của agent Gian hàng + ảnh/clip sự kiện chạy bằng tiến trình con */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { assert, expectNone } = require("../lib/framework");
const { APP_DIR, scriptOrder, seededState } = require("../lib/harness");

const read = f => fs.readFileSync(path.join(APP_DIR, f), "utf8");
const block = (src, head)=>{
  const i = src.indexOf(head); if(i < 0) return "";
  let j = src.indexOf("{", i + head.length), d = 0, k = j;
  for(; k < src.length; k++){ if(src[k] === "{") d++; else if(src[k] === "}"){ d--; if(!d) break; } }
  return src.slice(j + 1, k);
};
const NEW_JS = ["rbac.js","cloud-pt-directory.js","findpt.js","events-media.js","kb-data-1.js","kb-data-2.js","kb-data-3.js","kb-data-4.js","kb-data-5.js","kb-data-6.js","kb.js","cloud-admin.js","admin.js"];
const NEW_CSS = ["findpt.css","kb.css","admin.css"];
const EXT = [
  ["Gian hàng (shop-kit/test_core.js)", path.resolve(APP_DIR, "..", "_test", "shop-kit", "test_core.js"), /(\d+)\/(\d+) PASS/],
  ["Ảnh/clip sự kiện (events-media-kit/test_media.js)", path.resolve(APP_DIR, "..", "_test", "events-media-kit", "test_media.js"), /PASS (\d+)\/(\d+)/],
];

module.exports = {
  name: "Tích hợp vòng 3: Quản trị & phân quyền, Tìm PT, Kho kiến thức, ảnh/clip sự kiện, Trang chủ & menu",
  area: "Tích hợp vòng 3 (index.html, sw.js, prepare-www.sh, firestore.rules, storage.rules, functions, pt.js, app.js, shop.js, community.js)",
  async define(t){
    /* ---------- 1. index.html ---------- */
    t.test("index.html: rbac.js ngay sau cloud.js; findpt sau community; events-media giữa cloud-events và events; kb-data → kb; cloud-admin → admin; health-safety CUỐI", ()=>{
      const o = scriptOrder(), at = f=> o.indexOf(f);
      expectNone(NEW_JS.filter(f=> at(f) < 0), "index.html thiếu script");
      assert.equal(o[at("cloud.js") + 1], "rbac.js", "rbac.js phải NGAY sau cloud.js");
      assert.ok(at("rbac.js") < at("app.js") && at("rbac.js") < at("events.js"), "rbac.js trước app.js / events.js");
      assert.ok(at("cloud-social.js") < at("cloud-pt-directory.js") && at("community.js") < at("cloud-pt-directory.js") && at("cloud-pt-directory.js") < at("findpt.js"), "cloud-social → community → cloud-pt-directory → findpt");
      assert.equal(o[at("cloud-events.js") + 1], "events-media.js", "events-media.js ngay sau cloud-events.js");
      assert.ok(at("events-media.js") < at("events.js") && at("shop-data.js") === at("shop.js") - 1, "events-media trước events; shop-data ngay trước shop");
      for(let i = 1; i <= 6; i++) assert.ok(at(`kb-data-${i}.js`) < at("kb.js") && at(`kb-data-${i}.js`) > at("pt.js"), `kb-data-${i}.js trước kb.js`);
      for(const m of ["cloud-events.js","events.js","shop.js","cloud-social.js","community.js","findpt.js","kb.js"]) assert.ok(at(m) < at("cloud-admin.js"), `${m} trước cloud-admin.js (bọc quyền)`);
      assert.equal(at("admin.js"), at("cloud-admin.js") + 1, "admin.js ngay sau cloud-admin.js");
      assert.equal(o[o.length - 1], "health-safety.js", "health-safety.js LUÔN CUỐI");
    });
    t.test("index.html: CSS mới trước brand.css / themes-modules.css; font Inter Tight 300/400 + JetBrains Mono 500", ()=>{
      const html = read("index.html");
      const css = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(m=> m[1]).filter(h=> !/^https?:/.test(h));
      for(const c of NEW_CSS) assert.ok(css.includes(c) && css.indexOf(c) < css.indexOf("brand.css"), c + " phải trước brand.css");
      assert.ok(css.indexOf("shop.css") < css.indexOf("findpt.css"), "CSS module mới sau shop.css");
      const font = (/fonts\.googleapis\.com\/css2\?([^"]+)"/.exec(html) || [])[1] || "";
      assert.match(font, /family=Inter\+Tight:wght@300;400/); assert.match(font, /family=JetBrains\+Mono:wght@500/);
    });

    /* ---------- 2. Đóng gói ---------- */
    t.test("sw.js: cache fitkit-v6, đủ file mới; không cache sẵn ảnh sản phẩm / Pexels / Storage", ()=>{
      const sw = read("sw.js");
      // vòng sửa UX (FIX-ux.md, QU-09): sw.js lên fitkit-v7 (SWR) → chấp nhận v6 trở lên thay vì đúng "v6"
      assert.ok(Number((/const CACHE = "fitkit-v(\d+)"/.exec(sw) || [])[1]) >= 6, "tên cache phải ≥ fitkit-v6");
      expectNone(NEW_JS.concat(NEW_CSS).filter(f=> !sw.includes(`"./${f}"`)), "sw.js thiếu");
      const assets = [...sw.matchAll(/"\.\/([^"]+)"/g)].map(m=> m[1]);
      assert.ok(!assets.some(a=> /assets\/shop\/|pexels|firebasestorage/.test(a)), "không đưa ảnh sản phẩm/Pexels vào ASSETS");
      expectNone(assets.filter(f=> !fs.existsSync(path.join(APP_DIR, f))), "sw.js trỏ tới file không tồn tại");
    });
    t.test("prepare-www.sh: chép mọi file mới + assets/shop/*.webp (không _build/), kiểm ảnh sản phẩm", ()=>{
      const sh = read("scripts/prepare-www.sh");
      const words = new Set(sh.split(/[\s\\]+/));
      expectNone(NEW_JS.concat(NEW_CSS).filter(f=> !words.has(f)), "prepare-www.sh thiếu");
      assert.match(sh, /cp assets\/shop\/\*\.webp www\/assets\/shop\//);
      assert.ok(!/cp -r assets\/shop|assets\/shop\/_build/.test(sh.replace(/#[^\n]*/g, "")), "không chép assets/shop/_build/");
      assert.match(sh, /for f in assets\/shop\/\*\.webp; do \[ -f "www\/\$f" \]/);
    });
    t.test("firebase.json: firestore rules + indexes, storage rules; firestore.indexes.json hợp lệ (users isPT+createdAt, collection group uid)", ()=>{
      const fb = JSON.parse(read("firebase.json"));
      assert.equal(fb.firestore.rules, "firestore.rules"); assert.equal(fb.firestore.indexes, "firestore.indexes.json");
      assert.equal(fb.storage.rules, "storage.rules");
      const ix = JSON.parse(read("firestore.indexes.json"));
      assert.ok(ix.indexes.some(i=> i.collectionGroup === "users" && i.fields.map(f=> f.fieldPath).join(",") === "isPT,createdAt"));
      for(const g of ["entries","regs","requests"]) assert.ok(ix.fieldOverrides.some(o=> o.collectionGroup === g && o.fieldPath === "uid" && o.indexes.some(x=> x.queryScope === "COLLECTION_GROUP")), "thiếu chỉ mục nhóm " + g);
    });

    /* ---------- 3. Rules ---------- */
    t.test("firestore.rules: RBAC hasPerm (không còn isAdmin), admin_audit chỉ-thêm, users cấm list, kb / ptListings / khoảnh khắc / feedback riêng tư; cân ngoặc", ()=>{
      const r = read("firestore.rules"), nc = r.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
      assert.ok(!/isAdmin\(\)|token\.admin/.test(nc), "còn isAdmin() / token.admin");
      assert.match(nc, /function hasPerm\(p\)/); assert.match(nc, /function staffFresh\(\)/);
      // rolePerms() khớp ma trận rbac.js
      const { core } = require(path.join(APP_DIR, "rbac.js"));
      const fn = /function rolePerms\(\) \{\s*return \{([\s\S]*?)\};\s*\}/.exec(nc); assert.ok(fn, "thiếu rolePerms()");
      const map = {}; let cur = null;
      fn[1].split("\n").forEach(line=>{ const k = /'([a-z_]+)':\s*\[/.exec(line); if(k){ cur = k[1]; map[cur] = []; line = line.slice(k.index + k[0].length); }
        if(cur) (line.match(/'([a-z]+\.[a-z_]+)'/g) || []).forEach(q=> map[cur].push(q.slice(1, -1))); });
      assert.deepEqual(map, core.MATRIX, "rolePerms() ≠ ma trận rbac.js");
      const users = block(nc, "match /users/{uid}");
      assert.match(users, /allow list: if false;/); assert.ok(!/allow read/.test(users));
      assert.match(block(nc, "match /admin_audit/{id}"), /allow update, delete: if false;/);
      assert.match(block(nc, "match /roles/{uid}"), /allow write: if false;/);
      assert.match(block(nc, "match /kb/{id}"), /resource\.data\.status == 'published' \|\| hasPerm\('kb\.edit'\)/);
      // sự kiện / thử thách bắt buộc ảnh/clip + mô tả
      assert.match(nc, /function okContent\(\)[\s\S]*?size\(\) >= 1[\s\S]*?'desc', ''\)\.size\(\) >= 80/);
      assert.match(block(nc, "match /events/{id}"), /allow create, update: if hasPerm\('events\.manage'\) && okContent\(\);/);
      assert.match(block(nc, "match /challenges/{id}"), /allow create, update: if hasPerm\('challenges\.manage'\) && okContent\(\);/);
      const ev = block(nc, "match /events/{id}");
      assert.match(ev, /match \/reviews\/\{rid\}[\s\S]*?okMedia\(\)[\s\S]*?checked_in/); assert.match(ev, /match \/mlikes\/\{uid\}/);
      // Tìm PT: điểm / xác minh / ẩn do quản trị; PT chỉ trả lời; đánh giá công khai
      const pl = block(nc, "match /ptListings/{lid}");
      assert.match(pl, /lockedKeys\(\)/); assert.match(pl, /hasPerm\('pt\.verify'\) && onlyKeys\(\['verified'/); assert.match(pl, /hasPerm\('listings\.moderate'\) && onlyKeys\(\['hidden'/);
      assert.match(pl, /me\(\) == lid && onlyKeys\(\['reply'\]\)/);
      assert.match(block(nc, "match /clients/{cid}/feedback/{fid}"), /fpc\(\)\.ptId == me\(\) \|\| fpc\(\)\.studentUid == me\(\)/);
      // collectionGroup reviews: gộp về bản chặt (signedIn)
      assert.match(nc, /match \/\{path=\*\*\}\/reviews\/\{rid\} \{ allow read: if signedIn\(\); \}/);
      const n = s=> (nc.replace(/'[^']*'/g, "''").match(new RegExp("\\" + s, "g")) || []).length;
      assert.equal(n("{"), n("}")); assert.equal(n("("), n(")")); assert.equal(n("["), n("]"));
      const body = nc.replace(/'[^']*'/g, "''");
      const defined = new Set([...body.matchAll(/function (\w+)\(/g)].map(x=> x[1]));
      const builtin = ["function","if","exists","existsAfter","get","getAfter","hasOnly","hasAny","hasAll","diff","affectedKeys","keys","size","lower","in","is","matches","toMillis","removeAll","concat"];
      expectNone([...new Set([...body.matchAll(/\b([a-zA-Z_]\w*)\(/g)].map(x=> x[1]))].filter(f=> !builtin.includes(f) && !defined.has(f)), "hàm rules chưa định nghĩa");
    });
    t.test("storage.rules: ảnh/clip sự kiện — đọc công khai, ghi theo vai trò claims + roles/{uid} (không dùng admins/{uid}), giới hạn loại/dung lượng", ()=>{
      const s = read("storage.rules"), nc = s.replace(/\/\/[^\n]*/g, "");
      assert.match(nc, /service firebase\.storage/);
      assert.ok(!/admins\//.test(nc), "không còn cấp quyền qua admins/{uid}");
      assert.match(nc, /function fresh\(\)[\s\S]*?roles\/\$\(request\.auth\.uid\)/);
      assert.match(nc, /video\/\(mp4\|webm\|quicktime\)/); assert.match(nc, /25 \* 1024 \* 1024/);
      assert.match(nc, /match \/media\/moments\/\{evId\}\/\{uid\}\/\{file\}[\s\S]*?checked_in/);
      assert.match(nc, /match \/\{all=\*\*\} \{ allow read, write: if false; \}/);
    });

    /* ---------- 4. Cloud Functions ---------- */
    t.test("functions/index.js export admin + findpt SAU initializeApp; xoá tài khoản dọn roles / xác minh PT / niêm yết; findpt tính điểm = cloud.ptdir.logic", ()=>{
      const src = read("functions/index.js");
      const init = src.indexOf("admin.initializeApp();");
      assert.ok(init > 0 && src.indexOf(`Object.assign(exports, require("./admin"));`) > init && src.indexOf(`Object.assign(exports, require("./findpt"));`) > init);
      assert.match(src, /USER_DOC_COLLECTIONS = \["users", "roles", "pt_verifications", "userSocial", "ptListings"\]/);
      assert.ok(!/FIT KIT/.test(src.split("\n").filter(l=> /HttpsError|toast|message/.test(l)).join("\n")), "thông báo lỗi còn tên cũ");
      // nạp functions/findpt.js với SDK giả
      const Module = require("module"), orig = Module._load;
      Module._load = function(req){ if(req === "firebase-functions/v2/firestore") return { onDocumentWritten: (o, h)=>{ h.opts = o; return h; } };
        if(req === "firebase-admin") return {}; return orig.apply(this, arguments); };
      let F; try{ delete require.cache[require.resolve(path.join(APP_DIR, "functions", "findpt.js"))]; F = require(path.join(APP_DIR, "functions", "findpt.js")); } finally { Module._load = orig; }
      assert.equal(typeof F.ptReviewAgg, "function"); assert.equal(F.ptReviewAgg.opts.document, "ptListings/{lid}/reviews/{ruid}"); assert.equal(F.ptRespAgg.opts.region, "asia-southeast1");
      const rv = [{ stars:5, criteria:{ expertise:5, punctual:4, attitude:5, results:4 } }, { stars:3, criteria:{ expertise:3, punctual:3, attitude:4, results:2 } }, { stars:1, hidden:true }];
      const a = F._findptTest.aggregateReviews(rv);
      assert.deepEqual([a.ratingAvg, a.ratingCount, a.reviewHidden, a.ratingDist[5], a.criteriaAvg.expertise], [4, 2, 1, 1, 4]);
      const now = Date.now(), H = 36e5;
      const r = F._findptTest.respStats([{ createdAt: now - H, respondedAt: now - H + 30*6e4 }, { createdAt: now - 2*H, respondedAt: now - 2*H + 90*6e4 }, { createdAt: now - 3*H }, { createdAt: now - 4*H, status:"cancelled" }], now);
      assert.deepEqual(r, { respN:3, respRate:67, respMins:60 });
    });

    /* ---------- 5. App (động cơ demo) ---------- */
    const app = await t.app({ settleMs: 200 });
    await app.settle(60);
    const run = code=> app.ev(`(async()=>{ ${code} })()`);
    const J = async code=>{ const v = await run(code); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
    const S = JSON.stringify;

    t.test("Nạp đủ module vòng 3 không lỗi: TE_RBAC, cloudAdmin, TE_ADMIN, cloud.ptdir, TE_FINDPT, TEKB (87 bài), TapMedia; teCan gọi RBAC", ()=>{
      assert.deepEqual(app.loadErrors.map(e=> e.file + ": " + e.error.message), []);
      const ty = app.evj(`({ rb: typeof TE_RBAC.can, ca: typeof cloudAdmin.setRole, adm: typeof TE_ADMIN.open, dir: typeof (cloud.ptdir && cloud.ptdir.list), fp: typeof (window.TE_FINDPT && TE_FINDPT.open),
        kb: typeof (window.TEKB && TEKB.open), kbSame: window.TEKB === window.TE_KB, media: typeof (window.TapMedia && TapMedia.validate), wrapped: cloudEvents.__rbac === true })`);
      assert.deepEqual(ty, { rb:"function", ca:"function", adm:"function", dir:"function", fp:"function", kb:"function", kbSame:true, media:"function", wrapped:true });
      assert.ok(app.ev("TEKB.articles.length") >= 87, "Kho kiến thức < 87 bài");
      app.run(`state.isAdmin = true;`);
      assert.equal(app.ev(`teCan("events.manage") || teCan("shop.orders") || state.isAdmin`), false, "state.isAdmin không cấp quyền");
      const errs = app.consoleLog.filter(c=> c[0] === "error").map(c=> c[1]).concat(app.asyncErrors.map(e=> e.stack || String(e)));
      assert.deepEqual(errs, []);
    });
    t.test("Trang chủ: Khám phá gọn 7 ô — Tìm PT · Cộng đồng · Sự kiện · Kho kiến thức · Gian hàng · Giáo án riêng · Giáo án mẫu; ô bấm mở đúng màn", async ()=>{
      app.call("goto", "home"); await app.settle(40);
      const L = app.evj("teHomeExplore.list().map(x=> [x.id, typeof x.title === 'function' ? x.title() : x.title])");
      assert.deepEqual(L.map(x=> x[0]), ["findpt","community","events","kb","shop","builder","templates"]);
      // fix-core vòng 2 (GLOSSARY §8.1): ô "Gian hàng" (pt.js) đổi chữ thành "Cửa hàng" — id "shop" giữ nguyên
      assert.deepEqual(L.slice(0, 5).map(x=> x[1]), ["Tìm PT","Cộng đồng","Sự kiện","Kho kiến thức","Cửa hàng"]);
      const h = app.lastHtml("home-content");
      assert.ok(["findpt","community","events","kb","shop"].every(id=> h.includes(`data-xid="${id}"`)), "ô chưa hiện trên Trang chủ");
      assert.ok(!/data-xid="(progress|exlib)"/.test(h), "ô Tiến độ / Bài tập đã bỏ khỏi Khám phá");
      const bad = [];
      for(const [id, check] of [["findpt", `document.getElementById("screen-findpt") && document.getElementById("screen-findpt").classList.contains("active")`],
                                ["community", `document.getElementById("screen-community").classList.contains("active")`],
                                ["events", `document.getElementById("screen-events").classList.contains("active")`],
                                ["kb", `TEKB.ui.view === "home"`]]){
        try{ app.ev(`teHomeExplore.open(${S(id)})`); await app.settle(40); if(!app.ev(check)) bad.push(id); }catch(e){ bad.push(id + ": " + e.message); }
        app.call("goto", "home"); await app.settle(20);
      }
      expectNone(bad, "ô Khám phá không mở đúng màn");
      assert.equal(app.asyncErrors.length, 0, app.asyncErrors.map(e=> e.message).join("; "));
    });
    /* fix-core vòng 2 (QU-18, FIX-ux §3, GLOSSARY §8.1) — hành vi đổi có chủ đích: menu ≤ 12 mục, 5 nhóm có tên
       (Kết nối PT + Cộng đồng & Sự kiện → "PT & cộng đồng"; Kiến thức + Cửa hàng → "Kiến thức & cửa hàng"; "Dinh dưỡng & sức khoẻ").
       Trang chủ / Hồ sơ / Lịch tuần / Thực đơn / PT / Giáo án mẫu / Tạo giáo án riêng / Kho video / Đi chợ / Gặp mặt & vé = lối tắt ẩn
       (nhóm cũ giữ, chỉ hiện khi tìm) — kiểm đủ ở 60-fix-core "QU-18". */
    t.test("Menu ☰ nhóm theo khu vực: Tập luyện · Dinh dưỡng & sức khoẻ · PT & cộng đồng · Kiến thức & cửa hàng · Quản trị (chỉ khi có vai trò)", ()=>{
      const groups = app.evj("TE_MENU_GROUPS.map(g=> g.title)");
      assert.deepEqual(groups, ["", "Tập luyện", "Dinh dưỡng & sức khoẻ", "PT & cộng đồng", "Kiến thức & cửa hàng", "Khác", "Quản trị"]);
      const slot = (attrs)=> app.evj(`(()=>{ const a = ${S(attrs)}; const row = { getAttribute: k=> k === "onclick" ? (a.onclick || null) : null, dataset: a.dataset || {},
        classList: { contains: c=> (a.cls || []).includes(c) } }; return teMenuSlot(row)[0]; })()`);
      const cases = [
        [{ onclick:"goto('home');closeSheet();" }, "main"], [{ onclick:"goto('reminders');closeSheet();" }, "nutri"],
        [{ onclick:"goto('workout');closeSheet();" }, "train"], [{ onclick:"openTemplateBrowser();" }, "train"], [{ onclick:"closeSheet();openProgramBuilder();" }, "train"],
        [{ onclick:"closeSheet();FKAch.open();" }, "train"], [{ onclick:"closeSheet();openHealthSafety();" }, "nutri"], [{ onclick:"goto('progress');closeSheet();" }, "train"],
        [{ onclick:"goto('nutrition');closeSheet();" }, "nutri"], [{ onclick:"goto('sleep');closeSheet();" }, "nutri"], [{ onclick:"closeSheet();NutriPro.ui.openShoppingList();" }, "nutri"],
        [{ onclick:"goto('coach');closeSheet();" }, "pt"], [{ dataset:{ fpMenu:"" } }, "pt"],
        [{ dataset:{ cmMenu:"" } }, "pt"], [{ cls:["te-menu"], dataset:{ te:"hub", id:"challenges" } }, "pt"], [{ cls:["te-menu"], dataset:{ te:"hub", id:"events" } }, "pt"],
        [{ dataset:{ kbMenu:"" }, onclick:"closeSheet();TEKB.open();" }, "kb"],
        [{ cls:["te-menu"], dataset:{ te:"hub", id:"shop" } }, "kb"],
        [{ cls:["adm-menu"] }, "admin"], [{ onclick:"alert(1)" }, "other"],
      ];
      expectNone(cases.filter(([a, g])=> slot(a) !== g).map(([a, g])=> `${JSON.stringify(a)} → ${slot(a)} (cần ${g})`), "phân nhóm menu");
      const appJs = read("app.js");
      assert.ok(appJs.includes(`<div class="link-row" onclick="goto('sleep');closeSheet();">`) && appJs.includes(`goto('reminders');closeSheet();`), "giữ mốc menu mà kb/events/admin dựa vào");
      assert.match(read("admin.js"), /goto\('reminders'\);closeSheet\(\);"\) >= 0 && R\.role\(\)/, "dòng Bảng quản trị chỉ chèn khi tài khoản có vai trò");
    });
    t.test("Owner không tự xoá được tài khoản (INTEGRATION-admin §6.6): chặn trước khi gọi cloud.deleteAccount", async ()=>{
      const src = read("pt.js");
      const i = src.indexOf(`$("#del-go").addEventListener("click", async ()=>{`);
      assert.ok(i > 0); const body = src.slice(i, i + 600);
      assert.ok(body.indexOf("if(isOwner())") >= 0 && body.indexOf("if(isOwner())") < body.indexOf("cloud.deleteAccount"), "phải chặn Owner trước deleteAccount");
      await run(`await cloud.signOut(); await cloud.signUp("owner.r3@tapeasy.vn", "matkhau1", "Chủ R3"); await cloudAdmin.bootstrapOwner(cloudAdmin.demoBootCode());`);   // fix-security QS-16: mã demo ngẫu nhiên riêng máy (bỏ mã công khai)
      assert.equal(app.ev("TE_RBAC.role()"), "owner");
      app.run(`globalThis.__del = 0; globalThis.__dOrig = cloud.deleteAccount; cloud.deleteAccount = async ()=>{ __del++; };`);
      app.call("openDeleteAccountSheet");
      const btn = app.dom.registry.get("del-go");
      const ls = (btn && btn._listeners && btn._listeners.click) || [];
      for(const fn of ls) await fn({ preventDefault(){}, stopPropagation(){}, target: btn });
      await app.settle(20);
      assert.equal(app.ev("__del"), 0, "Owner bấm xoá → không được gọi deleteAccount");
      assert.match(String(app.dom.registry.get("del-err").textContent), /Chủ sở hữu/);
      app.run(`cloud.deleteAccount = __dOrig;`);
    });
    t.test("Voucher toàn hệ thống (INTEGRATION-admin §6.2): mã do quản trị tạo → khách nhập ở giỏ → vào ví, áp giảm; mã sai bị từ chối; nhập lại không nhân bản", async ()=>{
      await run(`await TE_RBAC.login("matkhau1");`);
      await J(`return await cloudAdmin.saveVoucher({ code:"R3GIAM10", kind:"percent", value:10, cap:50000, min:100000, uses:100, exp:"2099-12-31", title:"Giảm 10% vòng 3" })`);
      await run(`await TE_RBAC.logout(); await cloud.signOut(); await cloud.signUp("khach.r3@mail.vn", "matkhau1", "Khách R3");`);
      const v = await J(`return await TapShop.applyVoucherCode("r3giam10")`);
      assert.ok(v && v.kind === "pct" && v.value === 10 && v.max === 50000 && v.min === 100000 && v.code === "R3GIAM10", JSON.stringify(v));
      const again = await J(`return await TapShop.applyVoucherCode("R3GIAM10")`);
      assert.equal(again && again.id, v.id, "nhập lại → dùng lại voucher cũ, không nhân bản");
      assert.equal(app.ev(`state.tapShop.vouchers.filter(x=> x.ref === "adm_R3GIAM10").length`), 1);
      const t1 = app.evj(`TapShop.core.totals([{ price:300000, qty:1 }], state.tapShop.vouchers.find(x=> x.ref === "adm_R3GIAM10"))`);
      assert.equal(t1.discount, 30000);
      assert.equal(await J(`return await TapShop.applyVoucherCode("KHONGCO99")`), null);
      assert.ok(read("shop.js").includes(`data-sx="vcode"`) && /tapeasy_settings_cache_v1/.test(read("shop.js")), "ô nhập mã + đọc cài đặt quản trị cho lần vẽ đầu");
    });
    t.test("teCan ở module: events/shop/community/findpt/kb ẩn công cụ quản trị khi không có quyền; community có Ẩn (kiểm duyệt) / Ghim theo quyền", ()=>{
      const ev = read("events.js"), sh = read("shop.js"), cm = read("community.js"), fp = read("findpt.js"), kb = read("kb.js");
      assert.match(ev, /ADMIN_SECTIONS\.filter\(s=> !s\.perm \|\| \[\]\.concat\(s\.perm\)\.some\(can\)\)/);
      assert.match(sh, /perm:"shop\.products"/); assert.match(sh, /perm:\["shop\.orders", "orders\.view"\]/);
      assert.match(cm, /can\("community\.moderate"\) \? `<button type="button" class="cm-act cm-mod" data-act="mod-hide">/);
      assert.match(cm, /can\("community\.feature"\) \? `<button type="button" class="cm-act cm-mod/);
      assert.match(cm, /A\.report\("routine", id, reason/);
      assert.match(fp, /can\("reviews\.moderate"\)/); assert.match(fp, /can\("listings\.moderate"\)/); assert.match(fp, /can\("pt\.verify"\)/);
      assert.match(kb, /can\("kb\.edit"\)/); assert.match(kb, /can\("kb\.publish"\)/);
      for(const [f, s] of [["events.js", ev], ["shop.js", sh], ["community.js", cm], ["findpt.js", fp], ["kb.js", kb]])
        assert.ok(!/(?:^|\n)\s*(?:const|let)\s+teCan\b/.test(s), f + " không được khai báo const/let teCan toàn cục");
      // người dùng thường: không thấy tab Quản trị của Sự kiện
      assert.equal(app.ev("TapEv.isAdmin()"), false);
    });

    /* ---------- 6. Bộ kiểm thử lõi của agent (nếu có trong máy) ---------- */
    for(const [name, file, re] of EXT){
      t.test(`Bộ kiểm thử lõi ${name} — nếu có trong máy`, ()=>{
        if(!fs.existsSync(file)){ t.info(name, ["Không có " + path.basename(file) + " (vd trên CI) — bỏ qua"]); return; }
        const out = execFileSync(process.execPath, [file], { cwd: path.dirname(file), encoding: "utf8", timeout: 120000, stdio: ["ignore", "pipe", "pipe"] });
        const m = re.exec(out); assert.ok(m, "không đọc được kết quả: " + out.slice(-300));
        assert.equal(m[1], m[2], `${name}: ${m[1]}/${m[2]}`);
        t.info(name, [m[0]]);
      });
    }
  },
};

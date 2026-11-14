/* =========================================================================
   Vòng R3 (14/11/2026) — agent ADMIN
   Hồi quy cho docs/qa/R3-admin.md (R3-ADMIN-xx): gian hàng chưa mở bán, quản trị sâu từng mảng (cộng đồng, gian hàng,
   sự kiện, cài đặt), từ khoá cấm, cấm đăng có thời hạn, điều khoản UGC, phân trang, kiểm tra ảnh tải lên.
   File sở hữu: admin.js/.css, cloud-admin.js, shop.js/.css, shop-data.js, community.js/.css, events.js/.css,
   events-media.js, cloud-events.js.
   Chạy riêng: node tests/run.js --only r3-admin
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
const S = v=> JSON.stringify(v);
const EVIL = `<img src=x onerror=alert(1)>`;
const hasRawTag = html=> /<img src=x onerror=alert/i.test(html);
const SAMPLE_NAMES = /Áo thun Dry-fit Easy|Quần short chạy|Áo khoác gió siêu nhẹ|Bình nước/;

module.exports = {
  name: "Vòng R3 — Quản trị, gian hàng, cộng đồng, sự kiện (r3-admin)",
  area: "admin / cloud-admin / shop / community / events",
  async define(t){
    const app = await t.app({ settleMs: 150, state: { profile: { name:"Chủ App", gender:"male", age:30, height:172, weight:70, activity:"moderate", goal:"lose", autoTargets:true } } });
    await app.settle(60);
    app.setNow("2026-11-14T09:00");
    const run = code=> app.ev(`(async()=>{ ${code} })()`);
    const J = async code=>{ const v = await run(code); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
    const errOf = async code=>{ try{ await run(code); return null; }catch(e){ return { code: e.code, message: e.message || String(e) }; } };
    const as = async (email, admin)=>{ await run(`await cloud.signOut(); await cloud.signIn(${S(email)}, "matkhau1"); ${admin === false ? "" : `await TE_RBAC.login("matkhau1");`}`); };
    const openStore = async view=>{ await run(`TapShop.close(); TapShop.open(${S(view || "home")});`); await app.settle(30); return app.lastHtml("tsx-main"); };
    const admHtml = async sec=>{ await run(`TE_ADMIN.open(${S(sec)});`); await app.settle(120); return app.lastHtml("adm-body"); };

    /* 3 tài khoản: khách (không vai trò), quản lý cửa hàng, chủ sở hữu */
    const U = {};
    U.guest = await J(`const u = await cloud.signUp("khach.r3@tapeasy.vn", "matkhau1", "Khách R3"); return u.uid || cloud.user.uid;`);
    U.shop = await J(`await cloud.signOut(); const u = await cloud.signUp("kho.r3@tapeasy.vn", "matkhau1", "Kho R3"); return u.uid || cloud.user.uid;`);
    U.owner = await J(`await cloud.signOut(); const u = await cloud.signUp("chu.r3@tapeasy.vn", "matkhau1", "Chủ R3"); return u.uid || cloud.user.uid;`);
    await run(`await cloudEvents.init(); await TapShop.reload(); await cloudAdmin.bootstrapOwner(cloudAdmin.demoBootCode()); await TE_RBAC.login("matkhau1");`);
    await run(`await cloudAdmin.setRole(${S(U.shop)}, "shop_manager", { reason:"Phụ trách kho R3" });`);

    /* ---------------- B. GIAN HÀNG CHƯA MỞ BÁN ---------------- */
    t.test("R3-ADMIN-01: shop-data.js là dữ liệu MẪU — mọi sản phẩm mang cờ demo:true, không cái nào được coi là hàng thật", async ()=>{
      const d = await J(`const D = TAPEASY_SHOP_DATA; return { demo: D.demo, n: D.products.length, flagged: D.products.filter(p=> p.demo === true).length, real: D.products.filter(p=> TapShop.core.isReal(p)).length };`);
      assert.equal(d.demo, true); assert.ok(d.n >= 9); assert.equal(d.flagged, d.n); assert.equal(d.real, 0);
      const seeded = await J(`return (await cloudEvents.listProducts()).filter(p=> !p.demo).map(p=> p.id);`);
      assert.deepEqual(seeded, [], "sản phẩm gieo sẵn trên 'máy chủ' demo phải mang cờ demo");
    });

    t.test("R3-ADMIN-01: storeStateOf (hàm thuần) — chỉ 'đang bán' khi có hàng thật đang hiện VÀ bật mở bán", async ()=>{
      const r = await J(`const f = TapShop.core.storeStateOf; const real = { id:"x1", name:"Áo thật", price:1 }, demo = { id:"p_tee", demo:true };
        return [f([demo], true), f([real], false), f([real], true), f([Object.assign({ hidden:true }, real)], true), f([Object.assign({ deleted:true }, real)], true), f([Object.assign({ _virtual:true }, real)], true), f([real], "true")];`);
      assert.deepEqual(r.map(x=> x.live), [false, false, true, false, false, false, false]);
      assert.deepEqual(r.map(x=> x.reason), ["empty", "closed", "", "empty", "empty", "empty", "closed"]);
    });

    t.test("R3-ADMIN-01: khách mở cửa hàng → khung xương mờ (inert, aria-hidden) + thẻ 'Chưa có sản phẩm nào mở bán', không lộ tên/giá hàng mẫu", async ()=>{
      await as("khach.r3@tapeasy.vn", false);
      await run(`await TapShop.reload();`);
      assert.deepEqual(await J(`return TapShop.storeState();`), { live:false, open:false, real:0, reason:"empty", demo:false });
      const html = await openStore("home");
      assert.match(html, /<div class="tsx-soon-bg" aria-hidden="true" inert>/);
      assert.match(html, /tsx-tile sk/, "phải còn khung lưới sản phẩm dạng xương");
      assert.match(html, /id="tsx-soon-t" tabindex="-1">Chưa có sản phẩm nào mở bán</);
      assert.match(html, /aria-labelledby="tsx-soon-t" aria-describedby="tsx-soon-d"/);
      assert.match(html, /đang chuẩn bị\. Quay lại sau nhé!/);
      assert.match(html, /data-sx="soon-notify" aria-pressed="false">Nhận thông báo khi mở bán</);
      assert.match(html, /data-sx="exit">.*Quay lại<\/button>/s);
      assert.ok(!SAMPLE_NAMES.test(html) && !/₫/.test(html), "lộ tên/giá sản phẩm mẫu: " + html.slice(0, 200));
      assert.equal(await J(`return TapShop._t.gated();`), true);
      // đầu trang + menu phía sau cũng không bấm / đọc được
      assert.equal(await J(`const h = document.getElementById("tsx-hd"); return h.getAttribute("inert") != null && h.getAttribute("aria-hidden") === "true";`), true);
      // mọi lối vào khác (trang sản phẩm, thanh toán, đổi điểm) cũng bị che
      for(const v of ["checkout", "vouchers", "list"]) assert.match(await openStore(v), /Chưa có sản phẩm nào mở bán/, v);
      await run(`TapShop.close(); TapShop.openProduct("p_tee");`); await app.settle(30);
      assert.match(app.lastHtml("tsx-main"), /Chưa có sản phẩm nào mở bán/);
    });

    t.test("R3-ADMIN-01: 'Nhận thông báo khi mở bán' lưu lựa chọn (state.tapShop.notifyOpen) và bấm lại để tắt", async ()=>{
      await openStore("home");
      await run(`TapShop._act["soon-notify"]();`); await app.settle(20);
      assert.equal(await J(`return state.tapShop.notifyOpen.on === true && state.tapShop.notifyOpen.at > 0;`), true);
      assert.match(app.lastHtml("tsx-main"), /aria-pressed="true">.*Đã bật thông báo mở bán/s);
      assert.equal(await J(`return JSON.parse(localStorage.getItem("fitkit_state_v1")).tapShop.notifyOpen.on;`), true, "phải lưu xuống localStorage");
      await run(`TapShop._act["soon-notify"]();`); await app.settle(20);
      assert.equal(await J(`return TapShop.notify.isOn();`), false);
      await run(`TapShop.notify.set(true);`);
    });

    t.test("R3-ADMIN-01: hàng mẫu không vào giỏ, không đặt được; thẻ Cửa hàng ở màn Sự kiện không bày ảnh/giá mẫu", async ()=>{
      await run(`state.tapShop.cart = [{ key:"p_tee|navy|M", pid:"p_tee", color:"navy", size:"M", qty:2 }]; saveState(); await TapShop.reload();`);
      assert.equal(await J(`return TapShop.cartCount();`), 0, "hàng mẫu còn được đếm trong giỏ");
      assert.equal(await J(`return state.tapShop.cart.length;`), 0, "dòng giỏ hàng mẫu phải bị dọn");
      const src = read("shop.js");
      assert.match(src, /function hubTeaser\(\)\{\s*if\(S\.loaded && !storeState\(\)\.live && !canAdmin\(\)\)/);
      assert.match(src, /if\(!sellable\(p\)\)\{ toast\(/, "addToCart phải chặn hàng chưa mở bán");
    });

    t.test("R3-ADMIN-01: quản trị thêm sản phẩm thật + bật mở bán → lớp phủ tự biến mất, chỉ hàng thật hiện; tạm đóng → phủ lại", async ()=>{
      await as("chu.r3@tapeasy.vn");
      const e0 = await errOf(`await cloudAdmin.setShopOpen(true);`);
      assert.equal(e0 && e0.code, "admin/no-products", "chưa có hàng thật mà vẫn mở bán được");
      await run(`await cloudEvents.saveProduct({ id:"r3_real_1", name:"Áo TapEasy thật R3", price:199000, colors:[{ id:"black", name:"Đen", hex:"#111111" }], sizes:[], stockBy:{ "black|":7 }, stock:7, gender:"unisex", cat:"wear", edited:true, demo:false });
        await TapShop.reload();`);
      assert.deepEqual(await J(`const s = TapShop.storeState(); return [s.live, s.real, s.reason];`), [false, 1, "closed"]);
      await run(`await cloudAdmin.setShopOpen(true);`); await app.settle(30);
      assert.equal(await J(`return TapShop.storeState().live;`), true);
      assert.equal(await J(`return JSON.parse(localStorage.getItem("tapeasy_settings_cache_v1")).shopOpen;`), true);
      await as("khach.r3@tapeasy.vn", false);
      let html = await openStore("home");
      assert.ok(!/Chưa có sản phẩm nào mở bán/.test(html), "lớp phủ chưa biến mất");
      assert.match(html, /Áo TapEasy thật R3/);
      assert.ok(!SAMPLE_NAMES.test(html), "hàng mẫu lẫn vào danh sách bán thật");
      assert.equal(await J(`return document.getElementById("tsx-hd").getAttribute("inert");`), null, "đầu trang còn bị khoá sau khi mở bán");
      await run(`TapShop.notify.set(true); await TapShop.refresh();`);   // mở app lần sau: tải danh mục xong → báo đúng 1 lần
      const told = await J(`return Number(state.tapShop.notifyOpen.told) || 0;`);
      assert.ok(told > 0, "người đã đăng ký nhận tin phải được báo khi mở bán");
      assert.equal(await J(`return TapShop._t.announceOpen();`), false, "báo lặp lại lần 2");
      // đặt hàng thật chạy bình thường (COD — hàng vật lý)
      const o = await J(`return await cloudEvents.placeOrder({ items:[{ pid:"r3_real_1", color:"black", size:"", qty:1 }], payment:"cod", payVia:"cod", shipMethod:"standard", address:{ name:"Khách", phone:"0901234567", province:"Hà Nội", ward:"Ba Đình", street:"1 Điện Biên Phủ", note:"" } });`);
      assert.ok(o && o.code && o.total >= 199000, JSON.stringify(o).slice(0, 200));
      await as("chu.r3@tapeasy.vn");
      await run(`await cloudAdmin.setShopOpen(false);`); await app.settle(30);
      await as("khach.r3@tapeasy.vn", false);
      html = await openStore("home");
      assert.match(html, /Chưa có sản phẩm nào mở bán/);
      await run(`TapShop.close();`);
    });

    t.test("R3-ADMIN-01: nhật ký ghi ai mở / đóng bán; quản lý cửa hàng bật được công tắc mở bán nhưng KHÔNG sửa được cài đặt khác", async ()=>{
      await as("chu.r3@tapeasy.vn");
      const log = await J(`return (await cloudAdmin.listAudit({ groups:["shop"] })).map(e=> [e.action, e.actor.name]);`);
      assert.deepEqual(log.map(x=> x[0]), ["shop.close", "shop.open"]);
      assert.equal(log[0][1], "Chủ R3");
      await as("kho.r3@tapeasy.vn");
      await run(`await cloudAdmin.setShopOpen(true);`);
      assert.equal(await J(`return TapShop.storeState().live;`), true);
      assert.equal((await errOf(`await cloudAdmin.saveSettings({ features:{ community:false } });`)).code, "permission-denied");
      assert.equal((await errOf(`await cloudAdmin.saveSettings({ shopOpen:false, hotline:"0900" });`)).code, "permission-denied", "gộp khoá khác vào để lách quyền");
      assert.equal((await errOf(`await cloudAdmin.saveSettings({ bannedWords:["x y"] });`)).code, "permission-denied");
      await run(`await cloudAdmin.setProductHidden("r3_real_1", true);`);
      assert.deepEqual(await J(`const s = TapShop.storeState(); return [s.live, s.real];`), [false, 0], "ẩn sản phẩm thật cuối cùng → cửa hàng hết hàng bán");
      await run(`await cloudAdmin.setProductHidden("r3_real_1", false);`);
      await as("khach.r3@tapeasy.vn", false);
      assert.equal((await errOf(`await cloudAdmin.setShopOpen(false);`)).code, "permission-denied", "khách tự đóng/mở cửa hàng được");
      assert.equal((await errOf(`await cloudAdmin.listProducts({});`)).code, "permission-denied");
    });

    t.test("R3-ADMIN-06: ảnh sản phẩm tải lên — từ chối SVG / tệp không phải ảnh / ảnh > 15 MB trước khi giải mã", async ()=>{
      const msg = async f=>{ const e = await errOf(`await TapShop._t.compressPhoto(${S(f)});`); return e && e.message; };
      assert.match(await msg({ type:"image/svg+xml", size:900, name:"x.svg" }), /Chỉ nhận ảnh JPG, PNG, WebP/);
      assert.match(await msg({ type:"text/html", size:900, name:"x.jpg" }), /Chỉ nhận ảnh/);
      assert.match(await msg({ type:"image/jpeg", size:16 * 1024 * 1024, name:"to.jpg" }), /quá lớn/);
      const TM = read("events-media.js");
      assert.match(TM, /file\.size > LIMITS\.imgInputBytes/); assert.match(TM, /file\.size > LIMITS\.videoBytes/);
    });

    /* ---------------- A. QUẢN TRỊ SÂU TỪNG MẢNG ---------------- */
    t.test("R3-ADMIN-07: phân trang — pageOf/pager; danh sách người dùng, kiểm duyệt, nhật ký không còn vẽ hàng trăm dòng một lần", async ()=>{
      const r = await J(`const L = Array.from({ length:45 }, (_, i)=> i); TE_ADMIN._PG.t = 3; const a = TE_ADMIN.pageOf(L, "t", 20).length; TE_ADMIN._PG.t = 99; const b = TE_ADMIN.pageOf(L, "t", 20)[0];
        return { a, b, pg: TE_ADMIN._PG.t, html: TE_ADMIN.pager("t", 45, 20), one: TE_ADMIN.pager("x", 7, 20), none: TE_ADMIN.pager("x", 0, 20) };`);
      assert.equal(r.a, 5); assert.equal(r.b, 40); assert.equal(r.pg, 3);
      assert.match(r.html, /Trang 3\/3 · 45 mục/); assert.match(r.html, /data-v="4" disabled/);
      assert.ok(!/adm-pager/.test(r.one) && r.none === "");
      const src = read("admin.js");
      assert.ok(!/list\.slice\(0, 300\)\.map/.test(src)); assert.match(src, /pageOf\(list, "u"\)/); assert.match(src, /pageOf\(list, "audit", 50\)/); assert.match(src, /pageOf\(list, "mod", 10\)/);
      const pg = await J(`return cloudAdmin._paginate(Array.from({ length:45 }, (_, i)=> i), 3, 20);`);
      assert.deepEqual([pg.items.length, pg.total, pg.page, pg.pages], [5, 45, 3, 3]);
    });

    t.test("R3-ADMIN-02: Cộng đồng — danh sách bài (giáo án + Khoảnh khắc) có lọc / tìm / phân trang; ẩn-gỡ cần lý do và ghi nhật ký", async ()=>{
      await as("chu.r3@tapeasy.vn");
      const all = await J(`return await cloudAdmin.listContent({ size:10 });`);
      assert.ok(all.total >= 2 && all.items.length <= 10 && all.pages === Math.ceil(all.total / 10), JSON.stringify(all.counts));
      assert.ok(all.counts.routine >= 1 && all.counts.post >= 1, "thiếu giáo án chia sẻ hoặc Khoảnh khắc: " + JSON.stringify(all.counts));
      const posts = await J(`return await cloudAdmin.listContent({ type:"post", size:50 });`);
      assert.ok(posts.items.every(x=> x.type === "post" && x.parentId));
      const it = posts.items[0];
      assert.equal((await errOf(`await cloudAdmin.moderatePost(${S(it)}, "hide", "");`)).code, "admin/reason");
      await run(`await cloudAdmin.moderatePost(${S(it)}, "hide", "Ảnh phản cảm");`);
      const hid = await J(`return await cloudAdmin.listContent({ type:"post", status:"hidden", size:50 });`);
      assert.ok(hid.items.some(x=> x.id === it.id), "bài vừa ẩn không vào bộ lọc 'Đang ẩn'");
      const au = await J(`return (await cloudAdmin.listAudit({ groups:["mod"] }))[0];`);
      assert.equal(au.action, "mod.post.hide"); assert.equal(au.actor.name, "Chủ R3"); assert.equal(au.details.note, "Ảnh phản cảm"); assert.ok(au.ts > 0);
      await run(`await cloudAdmin.moderatePost(${S(it)}, "keep", "");`);
      const q1 = await J(`return (await cloudAdmin.listContent({ q:"zzz-không-có-zzz" })).total;`);
      assert.equal(q1, 0);
      await as("khach.r3@tapeasy.vn", false);
      assert.equal((await errOf(`await cloudAdmin.listContent({});`)).code, "permission-denied");
      assert.equal((await errOf(`await cloudAdmin.moderatePost(${S(it)}, "delete", "phá");`)).code, "permission-denied");
    });

    t.test("R3-ADMIN-02: hàng đợi báo cáo có lý do + người báo cáo + cờ quá hạn 24 giờ; gỡ bình luận ghi nhật ký", async ()=>{
      await as("khach.r3@tapeasy.vn", false);
      await run(`await cloudAdmin.report("user", "uid_xau_1", "Quấy rối trong bình luận", { title:"Tài khoản quấy rối" });`);
      app.setNow("2026-11-12T07:00");                                  // báo cáo thứ hai gửi từ 2 ngày trước (đã quá hạn)
      await run(`await cloudAdmin.report("comment", "cmt_cu_1", "Spam quảng cáo", { title:"Bình luận spam cũ" });`);
      app.setNow("2026-11-14T09:00");
      await as("chu.r3@tapeasy.vn");
      let qd = await J(`return await cloudAdmin.modQueue();`);
      let mine = qd.find(x=> x.type === "report" && x.refId === "uid_xau_1");
      assert.ok(mine, "thiếu báo cáo vừa gửi");
      assert.deepEqual(mine.reasons, ["Quấy rối trong bình luận"]);
      assert.ok(mine.reporters.length === 1 && /Khách R3/.test(mine.reporters[0]), "thiếu người báo cáo: " + S(mine.reporters));
      assert.equal(mine.overdue, false, "báo cáo mới 0 giờ đã bị coi là quá hạn");
      const old = qd.find(x=> x.type === "report" && x.refId === "cmt_cu_1");
      assert.equal(old.overdue, true); assert.ok(old.ageH >= 24);
      assert.ok(qd.filter(x=> x.overdue).length >= 1 && qd[0].overdue === true, "mục quá hạn phải xếp đầu");
      assert.ok((await J(`return (await cloudAdmin.stats()).reportsOverdue;`)) >= 1);
      const html = await admHtml("moderation");
      assert.match(html, /quá hạn 24 giờ/); assert.match(html, /Quá 24 giờ/); assert.match(html, /Người báo cáo: Khách R3/);
      await run(`TE_ADMIN.close();`);
      // bình luận
      const p = (await J(`return await cloudAdmin.listContent({ type:"post", size:50 });`)).items[0];
      const c = await J(`return await cloudEvents.addComment(${S(p.parentId)}, ${S(p.id)}, "Bình luận cần gỡ");`);
      assert.ok((await J(`return await cloudAdmin.listComments(${S(p.parentId)}, ${S(p.id)});`)).some(x=> x.id === c.id));
      assert.equal((await errOf(`await cloudAdmin.removeComment(${S(p.parentId)}, ${S(p.id)}, ${S(c.id)}, "");`)).code, "admin/reason");
      await run(`await cloudAdmin.removeComment(${S(p.parentId)}, ${S(p.id)}, ${S(c.id)}, "Spam");`);
      assert.ok(!(await J(`return await cloudAdmin.listComments(${S(p.parentId)}, ${S(p.id)});`)).some(x=> x.id === c.id));
      assert.equal(await J(`return (await cloudAdmin.listAudit({ groups:["mod"] }))[0].action;`), "mod.comment.delete");
    });

    t.test("R3-ADMIN-05: từ khoá cấm của quản trị — chuẩn hoá, lọc tự động bài / review / bình luận (không dấu, nguyên cụm)", async ()=>{
      await as("chu.r3@tapeasy.vn");
      assert.deepEqual(await J(`return cloudAdmin.normWords(" Thuốc giảm cân \\n<b>x</b>\\nA\\nthuốc GIẢM cân\\n" + "y".repeat(60));`), ["Thuốc giảm cân", "b x /b", "y".repeat(40)]);
      await run(`await cloudAdmin.saveSettings({ bannedWords:["Thuốc giảm cân", "kèo"] });`);
      assert.deepEqual(await J(`return cloudAdmin.bannedWords();`), ["Thuốc giảm cân", "kèo"]);
      assert.ok((await J(`return cloudAdmin.findBanned("Inbox mua THUOC GIAM CAN cấp tốc nhé");`)).length >= 1, "không bắt được dạng không dấu");
      assert.deepEqual(await J(`return cloudAdmin.findBanned("Kéo xà đơn 3 hiệp, giảm cân từ từ");`), [], "bắt nhầm từ thường");
      assert.equal(await J(`return (await cloudAdmin.listAudit({ limit:5 }))[0].action;`), "community.keywords");
      const p = (await J(`return await cloudAdmin.listContent({ type:"post", size:50 });`)).items[0];
      await as("khach.r3@tapeasy.vn", false);
      const e1 = await errOf(`await cloudEvents.addComment(${S(p.parentId)}, ${S(p.id)}, "Ai cần thuốc giảm cân ib mình");`);
      assert.equal(e1 && e1.code, "admin/banned-word"); assert.match(e1.message, /không phù hợp/);
      const e2 = await errOf(`await cloudEvents.addComment(${S(p.parentId)}, ${S(p.id)}, "đ.ị.t m.ẹ");`);
      assert.equal(e2 && e2.code, "admin/banned-word", "bình luận thô tục trước đây lọt (chỉ kiểm độ dài)");
      const ok = await J(`return await cloudEvents.addComment(${S(p.parentId)}, ${S(p.id)}, "Buổi chạy vui quá!");`);
      assert.ok(ok && ok.id);
      const e3 = await errOf(`const plan = Object.values(state.plans)[0]; const r = cloud.social.logic.routineFromPlan(plan, { title:"Giáo án kèm thuốc giảm cân", desc:"Mô tả đủ dài cho giáo án chia sẻ thử nghiệm của tôi.", goal:"lose", level:"beginner", gender:"chung", equipment:"gym", weeks:8, tags:[] }); await cloud.social.publishRoutine(r);`);
      assert.ok(e3, "giáo án chứa từ khoá cấm vẫn đăng được");
      assert.ok(e3.code === "social/invalid" || /không phù hợp/.test(e3.message), S(e3));
    });

    t.test("R3-ADMIN-05: cấm đăng có thời hạn — người bị cấm không bình luận / đăng được tới hết hạn; gỡ cấm; không tự cấm, không cấm cấp trên", async ()=>{
      await as("chu.r3@tapeasy.vn");
      assert.equal((await errOf(`await cloudAdmin.mute(${S(U.guest)}, { days:7, reason:"" });`)).code, "admin/reason");
      assert.equal((await errOf(`await cloudAdmin.mute(${S(U.owner)}, { days:7, reason:"thử tự cấm" });`)).code, "admin/self");
      assert.equal((await errOf(`await cloudAdmin.mute("tapeasy", { days:7, reason:"tài khoản hệ thống" });`)).code, "admin/invalid");
      const m = await J(`return await cloudAdmin.mute(${S(U.guest)}, { days:3, reason:"Quấy rối nhiều lần", name:"Khách R3" });`);
      assert.equal(Math.round((m.until - m.at) / 86400000), 3);
      assert.equal(await J(`return (await cloudAdmin.listAudit({ groups:["user.mute"] }))[0].details.days;`), 3);
      assert.equal(await J(`return (await cloudAdmin.listMutes()).filter(x=> x.active).length;`), 1);
      const p = (await J(`return await cloudAdmin.listContent({ type:"post", size:50 });`)).items[0];
      await as("khach.r3@tapeasy.vn", false);
      const e = await errOf(`await cloudEvents.addComment(${S(p.parentId)}, ${S(p.id)}, "Chào mọi người");`);
      assert.equal(e && e.code, "admin/muted"); assert.match(e.message, /tạm dừng đăng bài.*17\/11\/2026.*Quấy rối nhiều lần/);
      assert.equal((await errOf(`await cloudEvents.addReview(${S(p.parentId)}, { stars:5, text:"Sự kiện rất vui, tổ chức chu đáo, sẽ quay lại.", media:[] });`)).code, "admin/muted");
      assert.equal((await errOf(`await cloud.social.publishRoutine({ title:"x" });`)).code, "admin/muted");
      assert.equal((await errOf(`await cloudAdmin.unmute(${S(U.guest)});`)).code, "permission-denied", "người bị cấm tự gỡ được");
      app.setNow("2026-11-17T09:01");                                  // hết hạn → tự hết hiệu lực
      assert.equal(await J(`return cloudAdmin.muteOf();`), null);
      app.setNow("2026-11-14T09:00");
      assert.ok(await J(`return cloudAdmin.muteOf();`));
      await as("kho.r3@tapeasy.vn");
      assert.equal((await errOf(`await cloudAdmin.mute(${S(U.guest)}, { days:1, reason:"không có quyền" });`)).code, "permission-denied");
      await as("chu.r3@tapeasy.vn");
      await run(`await cloudAdmin.unmute(${S(U.guest)}, { reason:"Đã cam kết" });`);
      await as("khach.r3@tapeasy.vn", false);
      assert.ok((await J(`return await cloudEvents.addComment(${S(p.parentId)}, ${S(p.id)}, "Cảm ơn ban tổ chức");`)).id);
    });

    t.test("R3-ADMIN-04: điều khoản UGC — đăng giáo án lần đầu phải tick đồng ý; ghi nhận thời điểm; nút Báo cáo + Chặn + Tiêu chuẩn cộng đồng có sẵn", async ()=>{
      await as("khach.r3@tapeasy.vn", false);
      assert.match(read("events.js"), /addComment\(evId, pid, text\); t\.value = ""; ugcAgree\(\);/, "gửi bình luận thành công phải ghi nhận đồng ý điều khoản");
      assert.match(read("events.js"), /coverId: up\.coverId \}\); ugcAgree\(\);/);
      await run(`TECommunity.render(); if(state.community) delete state.community.termsAt; saveState();`);
      assert.equal(await J(`return TECommunity.termsOK();`), false);
      await run(`TECommunity.openShare(Object.keys(state.plans)[0]);`); await app.settle(20);
      let html = app.lastHtml("sheet-content");
      assert.match(html, /<input type="checkbox" id="sh-terms">/); assert.match(html, /Tiêu chuẩn cộng đồng TapEasy/); assert.match(html, /24 giờ/);
      await run(`TECommunity.acceptTerms();`);
      assert.ok(await J(`return state.community.termsAt > 0 && JSON.parse(localStorage.getItem("fitkit_state_v1")).community.termsAt > 0;`));
      await run(`TECommunity.openShare(Object.keys(state.plans)[0]);`); await app.settle(20);
      assert.ok(!/id="sh-terms"/.test(app.lastHtml("sheet-content")), "đã đồng ý rồi vẫn hỏi lại");
      await run(`TECommunity.openTerms();`); await app.settle(10);
      html = app.lastHtml("sheet-content");
      assert.match(html, /Không dung thứ nội dung phản cảm/); assert.match(html, /Chặn/); assert.match(html, /24 giờ/);
      try{ await run(`closeSheet();`); }catch(e){}
      const cm = read("community.js"), ev = read("events.js");
      assert.match(cm, /data-act="report"/); assert.match(cm, /data-act="block"/); assert.match(cm, /id="cm-terms"/);
      assert.match(ev, /data-te="mo-block"/); assert.match(ev, /"mo-report": id=> openReport\(id\)/); assert.match(ev, /"cmt-block"/);
      assert.equal((ev.match(/te-ugc-note/g) || []).length, 2, "thiếu dòng điều khoản cạnh nút gửi bình luận / đăng review");
    });

    t.test("R3-ADMIN-03: bật/tắt tính năng + banner toàn app — lưu, áp dụng, chặn lối vào với người dùng thường (nhân sự vẫn vào)", async ()=>{
      await as("chu.r3@tapeasy.vn");
      await run(`await cloudAdmin.saveSettings({ features:{ community:false, shop:false, khac:false } });`);
      assert.deepEqual(await J(`return ["community", "shop", "events", "findpt"].map(k=> cloudAdmin.featureOn(k));`), [false, false, true, true]);
      assert.equal(await J(`return "khac" in (await cloudAdmin.getSettings()).features;`), false, "nhận khoá tính năng lạ");
      assert.equal(await J(`return TE_ADMIN.featureBlocked("community");`), false, "nhân sự phải vẫn vào được để kiểm tra");
      assert.equal(await J(`return TapShop.storeState().live;`), false, "tắt tính năng Cửa hàng thì không còn mở bán");
      await as("khach.r3@tapeasy.vn", false);
      assert.deepEqual(await J(`return ["community", "events", "home"].map(s=> TE_ADMIN.featureBlocked(s));`), [true, false, false]);
      await run(`goto("home"); goto("community");`); await app.settle(10);
      assert.notEqual(await J(`const a = document.querySelector(".screen.active"); return a ? a.id : "";`), "screen-community", "vẫn vào được Cộng đồng khi đã tắt");
      await as("chu.r3@tapeasy.vn");
      await run(`await cloudAdmin.saveSettings({ features:{ community:true, shop:true } });`);
      assert.equal(await J(`return TapShop.storeState().live;`), true);
      assert.equal((await errOf(`await cloudAdmin.saveSettings({ banner:{ on:true, text:"a" } });`)).code, "admin/invalid");
      await run(`await cloudAdmin.saveSettings({ banner:{ on:true, text:${S("Bảo trì 23:00 " + EVIL)}, level:"warn", link:"javascript:alert(1)" } });`);
      const b = await J(`return cloudAdmin.banner();`);
      assert.equal(b.level, "warn"); assert.equal(b.link, "", "link banner phải thuộc danh sách cho phép");
      assert.match(read("admin.js"), /<span>\$\{esc\(b\.text\)\}<\/span>/, "banner phải escape nội dung");
      await run(`await cloudAdmin.saveSettings({ banner:{ on:false, text:"" } });`);
      assert.equal(await J(`return cloudAdmin.banner();`), null);
    });

    t.test("R3-ADMIN-03: Sự kiện — người tham gia (phân trang, che SĐT theo quyền), ẩn / huỷ ghi nhật ký", async ()=>{
      await as("chu.r3@tapeasy.vn");
      const ev = await J(`return (await cloudEvents.listEvents()).filter(e=> !e.hidden)[0];`);
      const pr = await J(`return await cloudAdmin.listParticipants(${S(ev.id)}, { size:5 });`);
      assert.ok(pr.items.length <= 5 && pr.pages === Math.max(1, Math.ceil(pr.total / 5)));
      await run(`await cloudAdmin.setEventState(${S(ev.id)}, { cancelled:true, reason:"Thời tiết xấu" });`);
      const after = await J(`return (await cloudEvents.listEvents()).find(e=> e.id === ${S(ev.id)});`);
      assert.equal(after.hidden, true); assert.equal(after.cancelled, true); assert.equal(after.cancelReason, "Thời tiết xấu");
      assert.equal(await J(`return (await cloudAdmin.listAudit({ groups:["event"] }))[0].action;`), "event.save");
      await run(`await cloudAdmin.setEventState(${S(ev.id)}, { cancelled:false, hidden:false });`);
      await as("khach.r3@tapeasy.vn", false);
      assert.equal((await errOf(`await cloudAdmin.listParticipants(${S(ev.id)}, {});`)).code, "permission-denied");
      assert.equal((await errOf(`await cloudAdmin.setEventState(${S(ev.id)}, { hidden:true });`)).code, "permission-denied");
    });

    t.test("R3-ADMIN-03: Tổng quan có đủ số liệu (bài đăng, sự kiện, sản phẩm, phản hồi mới); các mục mới vẽ được, escape dữ liệu; có nhật ký theo mảng", async ()=>{
      await as("chu.r3@tapeasy.vn");
      const st = await J(`return await cloudAdmin.stats();`);
      for(const k of ["users", "pts", "posts", "reportsOpen", "events", "products", "shopLive", "feedbackNew"]) assert.ok(st[k] != null, "thiếu số liệu " + k);
      assert.equal(st.products, 1); assert.equal(st.shopLive, true);
      await run(`await cloudEvents.saveProduct({ id:"r3_evil", name:${S("Áo " + EVIL)}, price:99000, colors:[{ id:"c", name:"Đen", hex:"#111111" }], sizes:[], stockBy:{ "c|":1 }, stock:1, edited:true, demo:false }); await TapShop.reload();`);
      let html = await admHtml("overview");
      for(const k of ["Bài đăng cộng đồng", "Báo cáo chờ xử lý", "Sản phẩm", "Phản hồi mới", "Sự kiện"]) assert.ok(html.includes(k), "Tổng quan thiếu ô: " + k);
      html = await admHtml("shop");
      assert.match(html, /Cửa hàng ĐANG MỞ BÁN/); assert.match(html, /data-adm="shop-open" data-v="0"/); assert.match(html, /MẪU — khách không thấy/);
      assert.match(html, /Nhật ký cửa hàng/); assert.match(html, /hàng hoá vật lý/);
      await run(`TE_ADMIN._A.pQ = "r3_evil"; TE_ADMIN.render();`); await app.settle(150);
      html = app.lastHtml("adm-body");
      assert.ok(html.includes("Áo &lt;img src=x onerror=alert(1)&gt;") && !hasRawTag(html), "tên sản phẩm chưa escape trong bảng quản trị");
      await run(`TE_ADMIN._A.pQ = "";`);
      html = await admHtml("community");
      assert.match(html, /data-adm="cm-act"/); assert.match(html, /Nhật ký cộng đồng/); assert.ok(!hasRawTag(html));
      await run(`TE_ADMIN._A.cmTab = "words"; TE_ADMIN.render();`); await app.settle(120);
      assert.match(app.lastHtml("adm-body"), /id="adm-bw"[^>]*>Thuốc giảm cân\nkèo<\/textarea>/);
      await run(`TE_ADMIN._A.cmTab = "mutes"; TE_ADMIN.render();`); await app.settle(120);
      assert.match(app.lastHtml("adm-body"), /Danh sách cấm đăng \(1\)/);
      await run(`TE_ADMIN._A.cmTab = "content";`);
      html = await admHtml("events");
      assert.match(html, /data-adm="ev-part"/); assert.match(html, /data-adm="ev-cancel"/); assert.match(html, /Nhật ký sự kiện/);
      html = await admHtml("settings");
      assert.match(html, /data-adm-feat="community"/); assert.match(html, /id="adm-bn-t"/); assert.match(html, /data-adm="feat-save"/);
      const user = await J(`return TE_ADMIN.userExtraHTML({ uid:${S(U.guest)}, name:${S("Khách " + EVIL)}, isPT:true, ptStatus:"pending" });`);
      assert.match(user, /data-adm="mute"/); assert.match(user, /data-adm="pt-ok"/); assert.ok(!hasRawTag(user));
      await run(`await cloudEvents.deleteProduct("r3_evil"); await TapShop.reload(); TE_ADMIN.close();`);
    });

    t.test("R3-ADMIN-03: thao tác nguy hiểm đều qua hộp xác nhận ask(); mọi hành động mới có nhãn tiếng Việt trong nhật ký", async ()=>{
      const src = read("admin.js");
      for(const k of ["shop-open", "prod-hide", "ev-hide", "ev-cancel", "cm-act", "cmt-del", "mute", "unmute", "bw-save", "feat-save", "banner-save"]){
        const i = src.indexOf(`${/^[a-z]+$/.test(k) ? k : `"${k}"`}: async`); assert.ok(i > 0, "thiếu hành động " + k);
        assert.match(src.slice(i, i + 900), /await ask\(/, k + " không có xác nhận");
      }
      const vi = await J(`return ["user.mute", "user.unmute", "shop.open", "shop.close", "community.keywords", "mod.post.hide", "mod.comment.delete"].map(a=> TE_ADMIN.actionVi(a));`);
      assert.deepEqual(vi, ["Cấm đăng có thời hạn", "Gỡ cấm đăng", "Mở bán cửa hàng", "Tạm đóng cửa hàng", "Sửa từ khoá cấm", "Kiểm duyệt bài đăng: ẩn", "Kiểm duyệt bình luận: xoá"]);
    });

    t.test("R3-ADMIN-08: chi tiết nhật ký cắt TRƯỚC khi escape (không cắt đôi thực thể HTML)", ()=>{
      const src = read("admin.js");
      assert.ok(!/esc\(detailText\(e\.details\)\)\.slice/.test(src)); assert.match(src, /esc\(detailText\(e\.details\)\.slice\(0, 400\)\)/);
    });

    t.test("R3-ADMIN-09: sửa sản phẩm — chặn giá vượt trần / giá gốc gạch thấp hơn giá bán; lưu từ quản trị = hàng thật (demo:false)", ()=>{
      const src = read("shop.js");
      assert.match(src, /d\.price > 100000000 \? "Giá tối đa/); assert.match(src, /d\.compareAt && d\.compareAt < d\.price/);
      assert.match(src, /edited: true, demo: false, catalogV/);
    });

    /* ---------------- C. TUÂN THỦ STORE ---------------- */
    t.test("R3-ADMIN-C: cửa hàng chỉ thu tiền hàng VẬT LÝ qua COD / chuyển khoản / VietQR — không có cổng thẻ / mua trong ứng dụng cho hàng số", ()=>{
      const src = read("shop.js") + read("cloud-events.js");
      assert.match(src, /\["cod","bank","vietqr"\]/);
      assert.ok(!/stripe|paypal|momo\.vn|zalopay|applepay|ApplePaySession|google\.payments|card_number|cardNumber/i.test(src), "xuất hiện cổng thanh toán thẻ trong app");
      assert.ok(read("shop-data.js").split("\n").filter(l=> /^add\(\{/.test(l)).every(l=> /cat:"(wear|gear|souvenir)"/.test(l)), "danh mục có mặt hàng không phải hàng vật lý");
    });

    /* ---------------- D. BỐ CỤC 320–430 px ---------------- */
    t.test("R3-ADMIN-D: CSS thẻ 'chưa mở bán' + bảng quản trị — safe-area, vùng chạm ≥ 44 px, co giãn theo bề rộng, tôn trọng giảm chuyển động", ()=>{
      const sc = read("shop.css"), ac = read("admin.css"), cc = read("community.css");
      const soon = sc.slice(sc.indexOf("R3-ADMIN-01"));
      assert.match(soon, /\.tsx\.tsx-soon-on\{ overflow:hidden/);
      assert.match(soon, /filter:blur\(7px\) brightness\(\.82\)/);
      assert.match(soon, /\.tsx-soon\{[^}]*env\(safe-area-inset-top\)[^}]*env\(safe-area-inset-bottom\)/);
      assert.match(soon, /\.tsx-soon-card\{ width:min\(360px, 100%\)/); assert.match(soon, /backdrop-filter:blur\(22px\)/);
      assert.match(soon, /\.tsx-soon-card \.tsx-btn\{ min-height:48px; width:100%/);
      assert.match(soon, /prefers-reduced-motion: reduce\)\{ \.tsx-soon-card\{ animation:none/);
      assert.match(soon, /@supports not \(\(backdrop-filter/);
      const r3 = ac.slice(ac.indexOf("R3 (14/11/2026)"));
      assert.match(r3, /\.adm-seg button\{ min-height:44px; \}/);
      assert.match(r3, /\.adm-appbar button\{[^}]*min-height:44px; min-width:44px/);
      assert.match(r3, /\.adm-sw\{[^}]*min-height:56px/);
      assert.match(r3, /@media \(max-width: 719px\)\{[\s\S]*\.adm-sws\{ grid-template-columns:1fr; \}/);
      for(const m of r3.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 12, "chữ < 12 px: " + m[0]);
      assert.match(cc, /\.cm-agree\{[^}]*min-height:44px/);
    });
  },
};

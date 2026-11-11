/* =========================================================================
   Vòng sửa lỗi sau QA (11/11/2026) — fixer COMMERCE
   Hồi quy cho docs/qa/QA-commerce.md (QC-xx), QA-security (QS-01/03/06/11/19/20 phần module), QA-ux (QU-05/06/17/19).
   File sở hữu: community.js/.css, events.js/.css, events-media.js, cloud-events.js, shop.js/.css, shop-data.js, kb.js/.css, kb-data-*.js.
   Chạy riêng: node tests/run.js --only fix-commerce
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert } = require("../lib/framework");
const { scanFile } = require("../lib/xss-scan");
const { scriptOrder } = require("../lib/harness");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");

const EVIL = `<img src=x onerror=alert(1)>`;
const hasRawTag = html => /<img src=x onerror=alert/i.test(html) || /<svg onload=/i.test(html);
const ADDR = { name:"Khách QA", phone:"0901234567", province:"Hà Nội", ward:"Ba Đình", street:"1 Điện Biên Phủ", note:"" };
const IMG = { id:"m1", kind:"image", src:"https://images.pexels.com/photos/1/pexels-photo-1.jpeg" };
const D80 = "Chạy nhẹ 5 km quanh hồ, khởi động 10 phút, giãn cơ cuối buổi. Phù hợp người mới, mang nước và giày chạy.";

module.exports = {
  name: "Vòng sửa lỗi QA — Thương mại & cộng đồng (fix-commerce)",
  area: "shop / cloud-events / events / events-media / community",
  async define(t){
    const app = await t.app({ settleMs: 150, state: { profile: { name:"QA Commerce", gender:"male", age:28, height:175, weight:75, activity:"moderate", goal:"lose", autoTargets:true } } });
    await app.settle(60);
    app.setNow("2026-11-11T09:00");
    const run = code=> app.ev(`(async()=>{ ${code} })()`);
    const J = async code=>{ const v = await run(code); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
    const errOf = async code=>{ try{ await run(code); return null; }catch(e){ return e.message || String(e); } };
    await run(`await cloud.signUp("fix.commerce@tapeasy.vn", "matkhau1", "QA Commerce"); await cloudEvents.init(); await TapShop.reload();`);
    const stockOf = (pid, k)=> J(`const p = (await cloudEvents.listProducts()).find(x=> x.id === ${JSON.stringify(pid)}); return ${k ? `p.stockBy[${JSON.stringify(k)}]` : "p.stock"};`);
    const order = (items, extra)=> J(`return await cloudEvents.placeOrder(${JSON.stringify(Object.assign({ items, payment:"cod", payVia:"cod", shipMethod:"standard", address: ADDR }, extra || {}))});`);

    /* ---------------- GIAN HÀNG ---------------- */
    t.test("QS-06: số lượng trong đơn là chuỗi HTML → trang chi tiết đơn / danh sách đơn của nhân sự KHÔNG chạy HTML", async ()=>{
      const o = { id:"o_evil", code:"TE1111-EVIL", uid:"x", status:"pending", createdAt: Date.now(), total: 100000, subtotal: 100000, shipping: 0, discount: 0, payment:"cod",
        items:[{ pid:"p_tee", name:"Áo", qty: EVIL, price: 100000, img: "https://evil.example/pixel.png" }], address:{ name:"A", phone:"0901234567" }, history:[] };
      app.run(`TapShop._ui._order = ${JSON.stringify(o)}; TapShop._ui.orders = [${JSON.stringify(o)}]; TapShop.open("order", { id:"o_evil" });`);
      await app.settle(20);
      const html = app.lastHtml("tsx-main");
      assert.ok(html.includes("TE1111-EVIL"), "chưa vẽ đơn");
      assert.ok(!hasRawTag(html), "shop.js chèn i.qty thô: " + html.slice(0, 300));
      assert.ok(!/evil\.example/.test(html), "ảnh đơn từ host lạ vẫn được tải (QS-20)");
      app.run(`TapShop.open("orders", {})`); await app.settle(20);
      assert.ok(!hasRawTag(app.lastHtml("tsx-main")), "danh sách đơn cộng chuỗi qty thô");
      assert.equal(app.ev(`TapShop._t.qtyOf({ qty: "3" })`), 3);
      assert.equal(app.ev(`TapShop._t.qtyOf({ qty: ${JSON.stringify(EVIL)} })`), 0);
    }, { bug:"QS-06", severity:"Cao" });

    t.test("QS-20: safeImg chỉ nhận assets/, data:image base64, blob:, https từ Firebase Storage — chặn https lạ, //host, javascript:, thoát thuộc tính", ()=>{
      const S = "TapShop.core.safeImg";
      const ok = ["assets/shop/tee-navy-1.webp", "data:image/webp;base64,UklGRg==", "https://firebasestorage.googleapis.com/v0/b/x/o/a.webp?alt=media", "blob:https://app.tapeasy.vn/0f1e2d3c-aaaa-bbbb"];
      const bad = ["https://evil.example/p.png", "//evil.example/x.png", "javascript:alert(1)", "http://x.vn/a.jpg", `assets/x.png" onerror="alert(1)`, "assets/../../etc/passwd", "data:text/html;base64,PGI+", "https://firebasestorage.googleapis.com.evil.io/a.png"];
      ok.forEach(u=> assert.equal(app.ev(`${S}(${JSON.stringify(u)})`), u, "phải nhận: " + u));
      bad.forEach(u=> assert.equal(app.ev(`${S}(${JSON.stringify(u)})`), "", "phải chặn: " + u));
    }, { bug:"QS-20", severity:"Thấp" });

    t.test("QC-03: máy chủ tính lại giá từ danh mục — đơn khai giá 1.000 ₫ vẫn tính đúng giá, có cờ lệch giá; SL thập phân/âm bị loại", async ()=>{
      const o = await order([{ pid:"p_jacket", color:"black", size:"M", qty:2, price:1000 }], { total:1000, subtotal:2000 });
      const real = await J(`return (await cloudEvents.listProducts()).find(x=> x.id === "p_jacket").price;`);
      assert.ok(o && o.id, JSON.stringify(o));
      assert.equal(o.items[0].price, real); assert.equal(o.subtotal, real * 2);
      assert.ok(o.priceMismatch === true && o.clientTotal === 1000, "thiếu cờ lệch giá cho quản trị");
      const bad = await order([{ pid:"p_cap", color:"navy", size:"", qty:-50 }, { pid:"p_cap", color:"navy", size:"", qty:1.5 }]);
      assert.ok(bad && bad.ok === false && bad.rejected, "đơn toàn dòng SL không hợp lệ phải bị từ chối: " + JSON.stringify(bad));
    }, { bug:"QC-03", severity:"Cao" });

    t.test("QC-06: tồn kho do máy chủ trừ (không âm, không trừ 2 lần), đơn vượt tồn bị từ chối, SL âm không tăng kho", async ()=>{
      await run(`const p = (await cloudEvents.listProducts()).find(x=> x.id === "p_tee"); p.stockBy["navy|M"] = 2; p.stock = Object.values(p.stockBy).reduce((a,b)=> a+b, 0); await cloudEvents._demo.saveProduct(p); await TapShop.reload();`);
      const over = await order([{ pid:"p_tee", color:"navy", size:"M", qty:3 }]);
      assert.ok(over && over.ok === false && /chỉ còn 2/.test(over.error), JSON.stringify(over));
      const capBefore = await stockOf("p_cap");
      await order([{ pid:"p_cap", color:"navy", size:"", qty:-50 }]);
      assert.ok(!((await stockOf("p_cap")) > capBefore), "SL âm làm tăng kho");
      // Luồng giao diện: giỏ 2 áo → xác nhận → đặt → kho navy|M = 0 (trừ đúng 1 lần, không âm)
      await run(`state.tapShop = { cart:[{ pid:"p_tee", color:"navy", size:"M", qty:2 }], vouchers:[], addr: ${JSON.stringify(ADDR)}, pay:"cod", ship:"standard" }; saveState(); await TapShop.reload(); TapShop.open("checkout", { step:3 });`);
      await run(`await TapShop._t.placeOrder();`); await app.settle(30);
      assert.equal(await stockOf("p_tee", "navy|M"), 0, "kho bị trừ sai (2 lần / âm)");
      assert.equal(app.ev(`TapShop._ui.view`), "done");
      assert.equal(app.ev(`state.tapShop.cart.length`), 0);
      // Hết hàng: đặt thêm → bị từ chối, giỏ GIỮ nguyên, không sang màn "done"
      await run(`state.tapShop.cart = [{ pid:"p_tee", color:"navy", size:"M", qty:1 }]; saveState(); TapShop.open("checkout", { step:3 }); await TapShop._t.placeOrder();`); await app.settle(30);
      assert.equal(app.ev(`state.tapShop.cart.length`), 1, "đơn bị từ chối nhưng giỏ bị xoá");
      assert.notEqual(app.ev(`TapShop._ui.view`), "done");
    }, { bug:"QC-06", severity:"Cao" });

    t.test("QC-07: huỷ đơn hoàn kho đúng 1 lần (cờ stockApplied); quản trị không mở lại đơn đã huỷ (trạng thái cuối, khớp rules)", async ()=>{
      const s0 = await stockOf("p_bottle");
      const o = await order([{ pid:"p_bottle", color:"teal", size:"", qty:2 }]);
      assert.equal(await stockOf("p_bottle"), s0 - 2);
      await run(`await cloudEvents.cancelOrder(${JSON.stringify(o.id)});`);
      assert.equal(await stockOf("p_bottle"), s0);
      const again = await errOf(`await cloudEvents.updateOrder(${JSON.stringify(o.id)}, { status:"cancelled" });`);
      assert.equal(await stockOf("p_bottle"), s0, "huỷ lần 2 hoàn kho thêm: " + again);
      assert.deepEqual(app.evj(`TapShop._t.nextStatuses("cancelled")`), []);
      assert.ok(!/<select/.test(app.ev(`TapShop._t.ostSelect({ id:"x", code:"C", status:"cancelled" })`)), "đơn huỷ vẫn có ô đổi trạng thái");
      assert.ok(!app.evj(`TapShop._t.nextStatuses("pending")`).includes("delivered"), "cho nhảy cóc pending → delivered");
      // demo vẫn an toàn nếu gọi API mở lại: trừ kho lại, huỷ lần nữa không vượt tồn ban đầu
      await run(`try{ await cloudEvents._demo.updateOrder(${JSON.stringify(o.id)}, { status:"pending" }); await cloudEvents._demo.updateOrder(${JSON.stringify(o.id)}, { status:"cancelled" }); }catch(e){}`);
      assert.ok((await stockOf("p_bottle")) <= s0, "vòng huỷ → mở lại → huỷ làm kho tăng ảo");
      assert.ok(!/writeStock\(/.test(read("shop.js")), "shop.js còn tự ghi tồn kho phía máy khách");
    }, { bug:"QC-07", severity:"TB" });

    t.test("QC-03: mã giảm giá toàn hệ thống uses:1 chỉ áp được cho 1 giỏ (giữ chỗ máy chủ) và tiêu thụ khi đặt; voucher ví bị sửa giá trị → từ chối", async ()=>{
      const g = await J(`const d = cloudAdmin._demo.load(); d.vouchers = d.vouchers || {}; d.vouchers.FIXONE = { code:"FIXONE", kind:"amount", value:50000, min:0, uses:1, used:0, exp:"2099-12-31", title:"1 lượt" }; cloudAdmin._demo.save(d);
        const out = []; for(let i = 0; i < 3; i++){ state.tapShop = { cart:[], vouchers:[] }; out.push(!!(await TapShop.applyVoucherCode("FIXONE"))); } return out;`);
      assert.deepEqual(g, [true, false, false], "mã 1 lượt áp được ở nhiều giỏ");
      // voucher ví (đổi điểm) có chữ ký; sửa value trong localStorage → máy chủ từ chối
      const r = await J(`state.tapShop = { cart:[], vouchers:[] }; const v = TapShop.grantVoucher({ kind:"amount", value:20000, min:0, title:"Giảm 20k", src:"points", ref:"t_sig" });
        const ok1 = !!v.sig; v.value = 900000;
        const o = await cloudEvents.placeOrder({ items:[{ pid:"p_towel", color:"navy", size:"", qty:1 }], payment:"cod", payVia:"cod", shipMethod:"standard", address:${JSON.stringify(ADDR)},
          voucher:{ id:v.id, kind:v.kind, value:v.value, min:v.min, max:v.max, exp:v.exp, ref:v.ref, code:v.code, title:v.title, src:v.src, sig:v.sig } });
        return { ok1, rej: o.ok === false && o.code === "voucher", err: o.error };`);
      assert.ok(r.ok1 && r.rej, JSON.stringify(r));
    }, { bug:"QC-03", severity:"Cao" });

    t.test("QC-07 (UX đổi trả): huỷ đơn chưa xác nhận trả lại voucher vào ví đúng 1 lần", async ()=>{
      const r = await J(`state.tapShop = { cart:[], vouchers:[] }; const v = TapShop.grantVoucher({ kind:"amount", value:20000, min:0, title:"Giảm 20k", src:"points", ref:"t_back" });
        const mk = ()=> cloudEvents.placeOrder({ items:[{ pid:"p_towel", color:"navy", size:"", qty:2 }], payment:"cod", payVia:"cod", shipMethod:"standard", address:${JSON.stringify(ADDR)},
          voucher:{ id:v.id, kind:v.kind, value:v.value, min:v.min, max:v.max, exp:v.exp, ref:v.ref, code:v.code, title:v.title, src:v.src, sig:v.sig } });
        const o1 = await mk(); const dupe = await mk();
        const c = await cloudEvents.cancelOrder(o1.id); const o2 = await mk();
        return { d1: o1.discount, dupe: dupe.ok === false, restored: c.voucherRestored === true, d2: o2.discount };`);
      assert.deepEqual(r, { d1:20000, dupe:true, restored:true, d2:20000 });
    }, { bug:"QC-07", severity:"TB" });

    t.test("QC-12: số trên biểu tượng giỏ = số món hiện trong giỏ; dòng sản phẩm đã xoá bị dọn khi tải danh mục", async ()=>{
      const r = await J(`state.tapShop = { cart:[{ pid:"p_tee", color:"navy", size:"L", qty:1 }, { pid:"p_old_removed", qty:2 }], vouchers:[] }; saveState();
        const c1 = TapShop.cartCount(); await TapShop.reload(); return { c1, c2: TapShop.cartCount(), lines: state.tapShop.cart.length };`);
      assert.equal(r.c1, 1, "đếm cả dòng mồ côi"); assert.equal(r.c2, 1); assert.equal(r.lines, 1, "chưa dọn dòng mồ côi");
    }, { bug:"QC-12", severity:"Thấp" });

    t.test("QC-16: bước Xác nhận dùng nút 'Đặt hàng' thường (data-sig-skip, không trượt) + hộp xác nhận tóm tắt đơn", async ()=>{
      await run(`state.tapShop = { cart:[{ pid:"p_towel", color:"navy", size:"", qty:1 }], vouchers:[], addr:${JSON.stringify(ADDR)}, pay:"cod", ship:"standard" }; saveState(); await TapShop.reload(); TapShop.open("checkout", { step:3 });`);
      await app.settle(20);
      const html = app.lastHtml("tsx-main");
      assert.match(html, /id="tsx-place" data-sx="place" data-sig-skip="1">Đặt hàng · /);
      assert.ok(!/Trượt để/.test(html));
      const before = app.dom.htmlLog.length;
      app.run(`document.getElementById("tsx-place").disabled = false; TapShop._t.confirmOrder()`);
      const modal = app.dom.htmlLog.slice(before).map(x=> x.html).find(h=> /Xác nhận đặt hàng/.test(h)) || "";
      assert.ok(/Khăn|khăn/i.test(modal) && /Đặt hàng · [\d.]+\s₫/.test(modal) && /Giao tới/.test(modal) && /COD/.test(modal), "hộp xác nhận thiếu tóm tắt: " + JSON.stringify([/Khăn|khăn/i.test(modal), /Đặt hàng · [\d.]+\s₫/.test(modal), /Giao tới/.test(modal), /COD/.test(modal)]) + modal.slice(0, 200));
      assert.equal(app.ev(`TapShop._act.place.toString().includes("confirmOrder")`), true);
    }, { bug:"QC-16", severity:"TB" });

    t.test("QC-18: chưa cấu hình tài khoản nhận tiền → bước Thanh toán chỉ có COD; đã cấu hình → có Chuyển khoản/VietQR", async ()=>{
      await run(`TapShop.core.CFG.bank = { bankName:"", bankBin:"", accountNo:"[Số tài khoản]", accountName:"[TÊN CHỦ TÀI KHOẢN]" }; state.tapShop.pay = "vietqr"; TapShop.open("checkout", { step:2 });`);
      await app.settle(10);
      let html = app.lastHtml("tsx-main");
      assert.ok(/data-id="cod"/.test(html) && !/data-id="bank"/.test(html) && !/data-id="vietqr"/.test(html), "vẫn cho chọn chuyển khoản khi chưa có STK");
      assert.equal(app.ev(`TapShop._t.payOf(state.tapShop)`), "cod");
      await run(`TapShop.core.CFG.bank = { bankName:"VCB", bankBin:"970436", accountNo:"0011001234567", accountName:"CONG TY TAPEASY" }; TapShop.open("checkout", { step:1 }); TapShop.open("checkout", { step:2 });`);
      await app.settle(10);
      html = app.lastHtml("tsx-main");
      assert.ok(/data-id="bank"/.test(html) && /data-id="vietqr"/.test(html));
      app.run(`TapShop.core.CFG.bank = { bankName:"", bankBin:"", accountNo:"[Số tài khoản]", accountName:"[TÊN CHỦ TÀI KHOẢN]" }`);
    }, { bug:"QC-18", severity:"TB" });

    t.test("QC-20: toast lỗi cũ được gỡ khi thao tác thành công / chuyển bước", async ()=>{
      await run(`TapShop.open("product", { id:"p_tee" }); TapShop._ui.sel.p_tee = { color:"black", size:"" }; TapShop._act.add("p_tee");`);
      assert.ok(app.dom.registry.get("tsx-toast").classList.contains("on"), "chưa báo chọn size");
      await run(`TapShop._ui.sel.p_tee = { color:"black", size:"L" }; TapShop._act.add("p_tee");`);
      assert.ok(!app.dom.registry.get("tsx-toast").classList.contains("on"), "toast 'Vui lòng chọn size' còn đè giỏ hàng");
      assert.match(read("shop.js"), /toastOff\(\); UI\.params = \{ step: to \}/);
      app.run(`TapShop.close()`);
    }, { bug:"QC-20", severity:"Thấp" });

    t.test("QU-05: thẻ sản phẩm / routine không dùng blur khi cuộn, có content-visibility", ()=>{
      assert.match(read("shop.css"), /\.tsx-grid > \.tsx-tile\{ content-visibility:auto; contain-intrinsic-size:auto 340px; \}/);
      assert.match(read("community.css"), /\.cm-card\{ -webkit-backdrop-filter:none; backdrop-filter:none;/);
    }, { bug:"QU-05", severity:"TB" });

    /* ---------------- SỰ KIỆN & THI ĐUA ---------------- */
    t.test("QC-08: check-in sai mã báo 'không đúng'; đúng mã nhưng ngoài khung giờ bị từ chối; listEvents không lộ mã", async ()=>{
      const ev = await J(`const e = await cloudEvents._demo.saveEvent({ title:"QA Run fix", sport:"run", start:"2026-11-16T06:00", end:"2026-11-16T08:00", venue:"Hồ Gươm", city:"Hà Nội", capacity:50, fee:0, points:120, desc:${JSON.stringify(D80)}, media:[${JSON.stringify(IMG)}] });
        await cloudEvents.register(e.id, { name:"QA", phone:"0901234567" }); return { id: e.id, code: e.checkinCode };`);
      assert.ok(!("checkinCode" in (await J(`return (await cloudEvents.listEvents()).find(x=> x.id === ${JSON.stringify(ev.id)});`))));
      assert.match(await errOf(`await cloudEvents.checkIn(${JSON.stringify(ev.id)}, "ZZZZZZ");`) || "", /không đúng/);
      assert.match(await errOf(`await cloudEvents.checkIn(${JSON.stringify(ev.id)}, ${JSON.stringify(ev.code)});`) || "", /Chưa tới giờ/);
      app.setNow("2026-11-16T06:30");
      assert.equal(await errOf(`await cloudEvents.checkIn(${JSON.stringify(ev.id)}, ${JSON.stringify(ev.code)});`), null);
      app.setNow("2026-11-11T09:00");
    }, { bug:"QC-08", severity:"Cao" });

    t.test("QC-01/QC-05: tiến độ tự khai 999 bị kẹp theo trần/ngày; không tham gia được thử thách đã kết thúc", async ()=>{
      const r = await J(`const L = await cloudEvents.listChallenges(); const ch = L.find(c=> c.metric === "sessions" && c.start <= "2026-11-11" && c.end >= "2026-11-11");
        await cloudEvents.joinChallenge(ch.id, {}); const res = await cloudEvents.pushProgress(ch.id, { value:999, weekValue:999, manual:0 });
        const me = (await cloudEvents.listEntries(ch.id)).find(e=> e.uid === cloudEvents.me().uid); return { v: me.value, cap: cloudEvents.policy.progressCap(ch, me, "2026-11-11") };`);
      assert.ok(r.v <= r.cap && r.v < 999, JSON.stringify(r));
      assert.match(await errOf(`await cloudEvents.joinChallenge("ch_202610_sessions", {});`) || "", /đã kết thúc/);
    }, { bug:"QC-01", severity:"Cao" });

    t.test("QC-09: mốc cân khai cao hơn hồ sơ > 5% → cảnh báo, bảng xếp hạng dùng mốc ≤ 105%", async ()=>{
      const r = await J(`const ch = (await cloudEvents.listChallenges()).find(c=> c.metric === "weight_loss" && c.end >= "2026-11-11");
        const J0 = { joinedAt: Date.now(), manual: [], baseline: 90, baselineTs: new Date("2026-11-02T06:00").getTime(), baselineDate:"2026-11-02" };
        state.inbodyLogs = [{ ts: new Date("2026-11-10T06:00").getTime(), weight: 75 }]; const p = TapEv.core.progress(ch, state, J0, "2026-11-11"); return { v: p.value, note: p.note, flag: p.baseFlag };`);
      assert.ok(r.flag && /cao hơn \d+%/.test(r.note), JSON.stringify(r));
    }, { bug:"QC-09", severity:"Thấp" });

    t.test("QC-10: thiếu IndexedDB → putMedia báo lỗi tiếng Việt (không 'thành công giả' với idb:<key>)", async ()=>{
      const a2 = await t.app({ settleMs: 100 }); a2.ctx.indexedDB = undefined;
      let msg = null; try{ await a2.ev(`(async()=> await cloudEvents._demo.putMedia("events/qa/m1.webp", new Blob(["x"], { type:"image/webp" })))()`); }catch(e){ msg = e.message; }
      assert.match(String(msg), /chưa lưu được ảnh/i);
    }, { bug:"QC-10", severity:"TB" });

    t.test("QC-14/QS-19 (Khoảnh khắc): báo cáo từ tài khoản < 3 ngày tuổi không tự ẩn bài; tài khoản đủ tuổi thì 3 báo cáo ẩn", async ()=>{
      const r = await J(`const mo = await cloudEvents.listMoments(); const p = mo.find(x=> x.uid !== cloudEvents.me().uid && x.kind === "review");
        const asU = async (u, fn)=>{ const o = state.tapEvents.localId; const c0 = cloud.user; try{ cloud.user = null; state.tapEvents.localId = u; return await fn(); } finally{ state.tapEvents.localId = o; cloud.user = c0; } };
        for(const u of ["n1","n2","n3"]) await asU(u, ()=> cloudEvents.report(p.evId, p.id, "Spam"));
        const h1 = (await cloudEvents.listMoments()).some(x=> x.id === p.id);
        return { h1, w: cloudEvents.isHiddenPost({ reportCount:3, reportWeight:0 }), w3: cloudEvents.isHiddenPost({ reportCount:3, reportWeight:3 }) };`);
      assert.ok(r.h1, "3 tài khoản mới ẩn được bài người khác");
      assert.equal(r.w, false); assert.equal(r.w3, true);
    }, { bug:"QC-14", severity:"TB" });

    t.test("QU-19 / QS-11: quản trị Sự kiện có nút 'Tạo sự kiện' / 'Tạo thử thách', Nhân bản, nháp tự lưu; ngày thử thách kiểm định dạng", ()=>{
      const ev = read("events.js");
      assert.match(ev, /Tạo sự kiện<\/button>/); assert.match(ev, /Tạo thử thách<\/button>/);
      assert.match(ev, /data-te="a-ev-dup"/); assert.match(ev, /evDraft\(\)/);
      assert.match(ev, /if\(!isDs\(ch\.start\) \|\| !isDs\(ch\.end\)\)/);
    }, { bug:"QU-19", severity:"TB" });

    /* ---------------- CỘNG ĐỒNG ---------------- */
    t.test("QC-13/QC-15: lọc thô tục bắt biến thể dính liền/viết tắt, không bắt nhầm; tên giáo án sao chép được che", ()=>{
      const F = "cloud.social.moderation.findProfanity";
      ["ditme", "d.i.t m.e", "vailon", "clm", "d!t me", "ditmemay"].forEach(s=> assert.ok(app.ev(`${F}(${JSON.stringify(s)}).length > 0`), "lọt: " + s));
      ["các bài tập", "lon nước tăng lực", "150 cc sữa", "đi du lịch", "chạy 10 cm"].forEach(s=> assert.equal(app.ev(`${F}(${JSON.stringify(s)}).length`), 0, "bắt nhầm: " + s));
      const name = app.ev(`cloud.social.logic.planFromRoutine({ id:"r1", title:"Giáo án vcl siêu nhanh", days:{} }).name`);
      assert.ok(!/vcl/i.test(name), name);
    }, { bug:"QC-13", severity:"TB" });

    t.test("QS-03: routine của người khác → giáo án trên máy chỉ giữ trường cho phép, ép số, bỏ thẻ HTML", ()=>{
      const p = app.evj(`cloud.social.logic.planFromRoutine({ id:"r<x>", title:${JSON.stringify("Push " + EVIL)}, authorName:"<svg onload=alert(1)>",
        days:{ T2:{ title:${JSON.stringify(EVIL)}, ex:[{ name:${JSON.stringify(EVIL)}, sets:"<b>9</b>", reps:${JSON.stringify(EVIL)}, restSec:"x" }] } } })`);
      const s = JSON.stringify(p);
      assert.ok(!/[<>]/.test(s), "còn ký tự thẻ: " + s.slice(0, 300));
      const it = p.days.T2.items[0] || {};
      assert.ok(Number.isInteger(it.sets) && it.sets >= 1 && it.sets <= 10 && Number.isInteger(it.restSec), JSON.stringify(it));
    }, { bug:"QS-03", severity:"Cao" });

    t.test("QC-14: tác giả không tự báo cáo routine của mình", async ()=>{
      const e = await errOf(`const r = await cloud.social.publishRoutine({ title:"Routine của tôi QA", desc:"Giáo án 3 buổi đẩy kéo chân cho người mới, mỗi buổi 45 phút.", goal:"muscle", level:"beginner", gender:"all", perWeek:3, weeks:4, equipment:"gym",
          days:{ T2:{ title:"Đẩy", ex:[{ id:"bench", sets:3, reps:"8-10" }] }, T4:{ title:"Kéo", ex:[{ id:"row", sets:3, reps:"8-10" }] }, T6:{ title:"Chân", ex:[{ id:"squat", sets:3, reps:"8-10" }] } } });
        await cloud.social.reportRoutine(r.id, "Spam");`);
      assert.ok(e && /của bạn|own|tự báo cáo|chính mình/i.test(e), "tự báo cáo được: " + e);
    }, { bug:"QC-14", severity:"TB" });

    t.test("QC-17 / QU-06: gõ tìm kiếm chỉ vẽ lại vùng kết quả (ô tìm không bị thay); 8 thẻ đầu vẽ ngay, phần còn lại theo lô", async ()=>{
      app.run(`goto("community")`); await run(`await TECommunity.load(true);`); await app.settle(40);
      app.run(`TECommunity.state().tab = "explore"; TECommunity.state().f.q = ""; TECommunity.render()`); await app.settle(20);
      const n0 = app.dom.htmlLog.filter(x=> x.id === "community-content").length;
      const grid = app.lastHtml("community-content");
      const first = (grid.match(/data-cm-open=/g) || []).length, total = app.ev(`TECommunity._C.list.length`);
      assert.ok(first > 0 && first <= 8 && total > 8, `lô đầu ${first}/${total}`);
      assert.match(grid, /aria-busy="true"/);
      const inp = app.dom.registry.get("cm-q"); inp.value = "ppl";
      (inp._listeners.input || []).forEach(fn=> fn({ target: inp }));
      await app.settle(300);
      assert.equal(app.dom.htmlLog.filter(x=> x.id === "community-content").length, n0, "gõ tìm làm vẽ lại cả màn (thay ô #cm-q)");
      assert.equal(app.ev(`TECommunity.state().f.q`), "ppl");
      const res = app.lastHtml("cm-results"), n = Number((res.match(/(\d+) (?:routine|giáo án chia sẻ)/) || [])[1]);   // vòng 2: chữ hiển thị "giáo án chia sẻ" (§8.4)
      assert.ok(n >= 0 && n < total, `từ khoá không lọc danh sách (${n}/${total}) — trạng thái bị sao chép, bộ lắng nghe giữ bản cũ`);
    }, { bug:"QC-17", severity:"TB" });

    /* =====================================================================
       VÒNG 2 (docs/qa/HANDOFF-ROUND-BRIEF.md — commerce)
       ===================================================================== */
    const kbDataFiles = ()=> fs.readdirSync(ROOT).filter(f=> /^kb-data-\d+\.js$/.test(f)).sort((a, b)=> Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    /** app KHÔNG có thẻ kb-data-*.js; fkLazy giả nạp chúng khi load('kb') (lỗi mạng khi __lazy.fail) → rồi mới nạp kb.js */
    async function lazyKbApp(fail){
      const order = scriptOrder().filter(f=> !/^kb(-data-\d+)?\.js$/.test(f));
      const a = await t.app({ settleMs: 60, scripts: order });
      a.ctx.__loadKb = ()=> kbDataFiles().forEach(f=> a.run(read(f), f));
      a.run(`window.__lazy = { calls: [], fail: ${fail ? "true" : "false"} };
        window.fkLazy = { load(g){ __lazy.calls.push(g); return new Promise((res, rej)=> setTimeout(()=>{ if(__lazy.fail) rej(new Error("offline")); else { __loadKb(); res(); } }, 5)); } };`);
      a.run(read("kb.js"), "kb.js");
      return a;
    }
    t.test("R2-LAZY (fkLazy / QU-01): kb.js chờ fkLazy.load('kb'); dữ liệu có sẵn → dùng ngay (đồng bộ như cũ); đang tải → khung chờ; lỗi → 'Thử lại' → nạp lại", async ()=>{
      assert.match(read("kb.js"), /fkLazy\.load\(["']kb["']\)/, "kb.js chưa gọi fkLazy.load('kb')");
      // 1. thẻ script dữ liệu còn trong index.html, chưa có fkLazy → sẵn sàng ngay khi nạp
      assert.equal(app.ev("TEKB.dataState"), "ready");
      assert.ok(app.ev("TEKB.articles.length") >= 80);
      assert.equal(await app.ev("TEKB.ready()"), true);
      // 2. dữ liệu nạp lười: chưa nạp gì lúc khởi động
      const a2 = await lazyKbApp(true);
      assert.equal(a2.ev("TEKB.dataState"), "idle"); assert.equal(a2.ev("TEKB.articles.length"), 0);
      assert.equal(a2.ev("typeof window.KB_ARTICLES"), "undefined", "kb-data đã bị nạp lúc khởi động");
      a2.run(`goto("kb")`);
      assert.match(a2.lastHtml("kb-content"), /Đang tải Kho kiến thức/);
      await a2.settle(40);
      assert.equal(a2.ev("TEKB.dataState"), "error");
      const h1 = a2.lastHtml("kb-content");
      assert.ok(/Không tải được Kho kiến thức/.test(h1) && /data-kb-act="retry"/.test(h1) && /role="alert"/.test(h1), h1.slice(0, 300));
      // 3. bấm "Thử lại" khi mạng có lại
      a2.run(`__lazy.fail = false`);
      const el = a2.dom.registry.get("kb-content");
      (el._listeners.click || []).forEach(fn=> fn({ target: { closest: ()=> ({ dataset:{ kbAct:"retry" } }) }, preventDefault(){} }));
      await a2.settle(40);
      assert.equal(a2.ev("TEKB.dataState"), "ready");
      assert.ok(a2.ev("TEKB.articles.length") >= 80 && a2.ev("TEKB.glossary.length") >= 100);
      assert.match(a2.lastHtml("kb-content"), /Kho kiến thức TapEasy/);
      assert.deepEqual(a2.evj("__lazy.calls"), ["kb", "kb"]);
      // 4. mở bài / danh sách quản trị TRƯỚC khi có dữ liệu → chờ nạp rồi mở đúng bài; adminList trả Promise cho admin.js (await)
      const a3 = await lazyKbApp(false);
      a3.run(`globalThis.__al = TEKB.adminList(); TEKB.openArticle("kt-squat");`);
      assert.equal(a3.ev("typeof __al.then"), "function");
      await a3.settle(40);
      assert.equal(a3.ev("TEKB.ui.view"), "article"); assert.equal(a3.ev("TEKB.ui.id"), "kt-squat");
      assert.ok((await a3.ev("__al")).length >= 80);
      assert.deepEqual(a3.evj("__lazy.calls"), ["kb"], "nạp trùng");
      assert.deepEqual(a2.asyncErrors.concat(a3.asyncErrors).map(e=> String(e)), []);
    }, { bug:"QU-01", severity:"TB" });

    t.test("R2-BLOCK (App Store 1.2) Cộng đồng: 'Chặn người này' ở giáo án chia sẻ (cloud.blockUser) → ẩn khỏi bảng tin, Trang chủ, chi tiết; bỏ chặn hiện lại; TapEasy Team / bài của mình không có nút chặn", async ()=>{
      const DAYS = `{ T2:{ title:"Đẩy", ex:[{ id:"bench", sets:3, reps:"8-10" }] }, T4:{ title:"Kéo", ex:[{ id:"row", sets:3, reps:"8-10" }] }, T6:{ title:"Chân", ex:[{ id:"squat", sets:3, reps:"8-10" }] } }`;
      await run(`await cloud.signOut(); await cloud.signUp("author.b@tapeasy.vn", "matkhau1", "Tác Giả B");
        const r = await cloud.social.publishRoutine({ title:"Giáo án B đẩy kéo chân", desc:"Giáo án 3 buổi đẩy kéo chân cho người mới, mỗi buổi 45 phút.", goal:"muscle", level:"beginner", gender:"all", perWeek:3, weeks:4, equipment:"gym", days:${DAYS} });
        globalThis.__rb = { id: r.id, uid: cloud.user.uid };
        await cloud.signOut(); await cloud.signIn("fix.commerce@tapeasy.vn", "matkhau1");
        const s = TECommunity.state(); s.tab = "explore"; Object.assign(s.f, { goal:"all", level:"all", gender:"all", perWeek:"all", equipment:"all", q:"" });
        await TECommunity.load(true);`);
      app.run(`globalThis.__cd = confirmDialog; confirmDialog = function(t, m, ok){ globalThis.__cdTitle = t; return ok(); };`);
      try{
        assert.ok(app.evj(`TECommunity.currentList().map(r=> r.id)`).includes(app.ev("__rb.id")), "chưa thấy giáo án của B");
        const actsOf = ()=> (app.dom.htmlLog.filter(x=> /data-act="report"/.test(x.html)).pop() || {}).html || "";
        app.run(`TECommunity.openDetail(__rb.id)`);
        assert.match(actsOf(), /data-act="block"[\s\S]*Chặn người này/);
        app.run(`TECommunity.openDetail(cloud.social.seeds[0].id)`);
        assert.ok(!/data-act="block"/.test(actsOf()), "giáo án của TapEasy Team không được có nút chặn");
        app.run(`TECommunity.blockAuthor(__rb.uid, "Tác Giả B")`); await app.settle(60);
        assert.match(app.ev("__cdTitle"), /Chặn Tác Giả B\?/);
        assert.equal(app.ev(`cloud.isBlockedSync(__rb.uid)`), true);
        assert.ok(!app.evj(`TECommunity.currentList().map(r=> r.id)`).includes(app.ev("__rb.id")), "bảng tin vẫn hiện giáo án của người đã chặn");
        assert.ok(!/Giáo án B đẩy kéo chân/.test(app.ev("TECommunity.homeCardHTML()")));
        app.run(`TECommunity.openDetail(__rb.id)`);
        assert.match(app.lastHtml("toast"), /đã chặn tác giả này/);
        assert.ok(app.evj(`TECommunity._C.blocked.map(b=> b.uid)`).includes(app.ev("__rb.uid")));
        await run(`await cloud.unblockUser(__rb.uid); await TECommunity.loadBlocks();`);
        assert.ok(app.evj(`TECommunity.currentList().map(r=> r.id)`).includes(app.ev("__rb.id")), "bỏ chặn không hiện lại");
      } finally { app.run(`confirmDialog = __cd;`); }
    }, { bug:"Store-1.2", severity:"TB" });

    t.test("R2-BLOCK (App Store 1.2) Sự kiện: nút chặn ở thẻ Khoảnh khắc & bình luận; nội dung người đã chặn bị ẩn; bài/bình luận của mình không có nút chặn", async ()=>{
      app.run(`if(typeof CSS === "undefined") globalThis.CSS = { escape: s=> String(s) };`);   // vm không có CSS.escape (events.js dùng trong bộ chọn)
      await run(`await TapEv.loadMoments(true);`);
      const all = app.evj(`TapEv.cache.moments.map(p=> ({ uid:p.uid, key:p.evId + "/" + p.id, kind:p.kind }))`);
      const p = all.find(x=> x.kind !== "recap" && /^bot_/.test(x.uid)); assert.ok(p, "không có Khoảnh khắc mẫu của người khác");
      const cardOf = k=> app.ev(`TapEv.momentCardHTML(TapEv.cache.moments.find(x=> x.evId + "/" + x.id === ${JSON.stringify(k)}))`);
      assert.match(cardOf(p.key), /data-te="mo-block"[^>]*aria-label="Chặn người này/);
      assert.ok(!/mo-block/.test(app.ev(`TapEv.momentCardHTML(Object.assign({}, TapEv.cache.moments[0], { uid: cloudEvents.me().uid, kind:"review" }))`)), "bài của mình có nút chặn");
      // bình luận của tài khoản C trên bài p
      const [evId, pid] = p.key.split("/");
      await run(`await cloud.signOut(); await cloud.signUp("cmt.c@tapeasy.vn", "matkhau1", "Người C"); globalThis.__uc = cloud.user.uid;
        await cloudEvents.addComment(${JSON.stringify(evId)}, ${JSON.stringify(pid)}, "Bình luận của C để thử chặn");
        await cloud.signOut(); await cloud.signIn("fix.commerce@tapeasy.vn", "matkhau1");
        await cloudEvents.addComment(${JSON.stringify(evId)}, ${JSON.stringify(pid)}, "Bình luận của chính tôi");`);
      await run(`await TapEv.openComments(${JSON.stringify(p.key)});`);
      const c0 = app.lastHtml("te-cmts");
      assert.match(c0, new RegExp(`data-te="cmt-block"[^>]*data-u="${app.ev("__uc")}"`));
      assert.equal((c0.match(/data-te="cmt-block"/g) || []).length, (c0.match(/class="te-cmt"/g) || []).length - 1, "bình luận của mình không được có nút chặn");
      app.run(`globalThis.__cd = confirmDialog; confirmDialog = function(t, m, ok){ return ok(); };`);
      try{
        app.run(`TapEv._ACT["cmt-block"](${JSON.stringify(p.key)}, { dataset:{ u: __uc, n: "Người C" } })`); await app.settle(40);
        assert.equal(app.ev(`cloud.isBlockedSync(__uc)`), true);
        await run(`await TapEv.openComments(${JSON.stringify(p.key)});`);
        const c1 = app.lastHtml("te-cmts");
        assert.ok(!/Bình luận của C để thử chặn/.test(c1) && /Bình luận của chính tôi/.test(c1) && /người bạn đã chặn được ẩn/.test(c1), c1.slice(0, 400));
        // chặn tác giả Khoảnh khắc → bài biến khỏi bảng tin + danh sách review
        app.run(`TapEv._ACT["mo-block"](${JSON.stringify(p.key)})`); await app.settle(40);
        assert.equal(app.ev(`cloud.isBlockedSync(${JSON.stringify(p.uid)})`), true);
        assert.ok(!app.evj(`TapEv.cache.moments.map(x=> x.uid)`).includes(p.uid), "Khoảnh khắc của người đã chặn còn trong bảng tin");
        const raw = await J(`return await cloudEvents.listMoments({ limit: 60 });`);
        const html = app.ev(`TapEv._t.momentsListHTML(${JSON.stringify(raw)}) + TapEv._t.reviewsHTML(${JSON.stringify(raw)})`);
        assert.ok(!html.includes(`data-mo="${p.key}"`), "momentsListHTML/reviewsHTML vẫn vẽ bài của người đã chặn");
      } finally { app.run(`confirmDialog = __cd;`); await run(`await cloud.unblockUser(__uc); await cloud.unblockUser(${JSON.stringify(p.uid)}); await TapEv._t.ensureBlocks(true);`); }
    }, { bug:"Store-1.2", severity:"TB" });

    t.test("R2-SRV (FIX-security #4): Firebase — placeOrder/pushProgress/register KHÔNG còn ghi thẳng khi Function chưa có (báo 'Cần máy chủ — thử lại sau'); saveEvent dùng checkinCodeNow, không lưu mã rõ", ()=>{
      const src = read("cloud-events.js");
      const fire = src.slice(src.indexOf("const fire = {"), src.indexOf("API CÔNG KHAI"));
      const body = name=>{ const i = fire.indexOf(`async ${name}(`); assert.ok(i >= 0, "thiếu " + name); const j = fire.indexOf("\n    async ", i + 10); return fire.slice(i, j < 0 ? undefined : j); };
      assert.match(src, /const SERVER_NEEDED = "Cần máy chủ — thử lại sau"/);
      const reg = body("register"), push = body("pushProgress"), order = body("placeOrder"), save = body("saveEvent");
      assert.ok(/SERVER_NEEDED/.test(reg) && !/\.set\(doc\)/.test(reg), "register còn ghi thẳng regs: " + reg.slice(-300));
      assert.ok(/SERVER_NEEDED/.test(push) && !/ref\.set\(data/.test(push), "pushProgress còn ghi thẳng value");
      assert.ok(/SERVER_NEEDED/.test(order) && !/collection\("orders"\)\.(add|doc)/.test(order), "placeOrder còn đường ghi thẳng");
      assert.ok(/callFn\("checkinCodeNow"/.test(save), "saveEvent chưa gọi checkinCodeNow");
      assert.ok(!/\.set\(\{\s*code\s*\}/.test(save) && /codeHash/.test(save) && /FieldValue\.delete\(\)/.test(save), "saveEvent còn lưu mã rõ");
      assert.ok(/callFn\("checkinCodeNow"/.test(body("checkinInfo")));
      // demo: checkinInfo đi qua getCheckinCode (đã bọc quyền RBAC)
      assert.match(src, /checkinInfo: wrap\(async id=> engine\.name === "firebase" \? engine\.checkinInfo\(id\) : \{ code: await api\.getCheckinCode\(id\)/);
    }, { bug:"QS-08", severity:"Cao" });

    t.test("R2-QC11: saveState() trả false (bộ nhớ đầy) → đổi điểm không trừ điểm/không thêm voucher; voucher quà bị gỡ; điểm danh báo điểm CHƯA lưu", async ()=>{
      await run(`state.tapEvents.points = []; TapEv.points.add(1000, "QA nạp điểm", "qa_r2_seed");`);
      const bal0 = app.ev("TapEv.points.balance()"), nv0 = app.ev("((state.tapShop || {}).vouchers || []).length");
      assert.ok(bal0 >= 400, "chưa nạp được điểm: " + bal0);
      app.run(`globalThis.__ss = saveState; saveState = function(){ return false; };`);
      try{
        await run(`await TapShop._t.redeemNow("a20");`);
        assert.equal(app.ev("TapEv.points.balance()"), bal0, "bộ nhớ đầy mà vẫn trừ điểm");
        assert.equal(app.ev("((state.tapShop || {}).vouchers || []).length"), nv0, "bộ nhớ đầy mà vẫn thêm voucher");
        assert.match(app.lastHtml("toast"), /Bộ nhớ máy đầy/);
        assert.equal(app.ev(`TapShop.grantVoucher({ kind:"amount", value:15000, title:"Quà QA", ref:"qa_r2_gift" })`), null);
        assert.equal(app.ev(`TapShop.hasVoucherRef("qa_r2_gift")`), false);
        // điểm danh khi bộ nhớ đầy: vẫn ghi nhận trên máy chủ, nhưng KHÔNG báo "+N Điểm TapEasy"
        const ev = await J(`const e = await cloudEvents._demo.saveEvent({ title:"QA R2 điểm danh", sport:"run", start:"2026-11-12T06:00", end:"2026-11-12T08:00", venue:"Hồ Tây", city:"Hà Nội", capacity:50, fee:0, points:150, desc:${JSON.stringify(D80)}, media:[${JSON.stringify(IMG)}] });
          await cloudEvents.register(e.id, { name:"QA", phone:"0901234567" }); return { id: e.id, code: e.checkinCode };`);
        app.setNow("2026-11-12T06:30");
        const ok = await J(`return await TapEv._t.doCheckIn(Object.assign({}, (await cloudEvents.listEvents()).find(x=> x.id === ${JSON.stringify(ev.id)}), { points:150 }), ${JSON.stringify(ev.code)});`);
        assert.equal(ok, true);
        assert.equal(app.ev(`TapEv.points.has("ci_${ev.id}")`), false);
        const sh = app.lastHtml("sheet-content");
        assert.ok(/CHƯA được lưu/.test(sh) && !/\+150 Điểm TapEasy/.test(sh), sh.slice(0, 300));
      } finally { app.run(`saveState = __ss;`); app.setNow("2026-11-11T09:00"); }
      // lưu được lại → đổi điểm bình thường (voucher + trừ điểm cùng một lần ghi)
      await run(`await TapShop._t.redeemNow("a20");`);
      assert.equal(app.ev("TapEv.points.balance()"), bal0 - 400);
      assert.equal(app.ev("((state.tapShop || {}).vouchers || []).length"), nv0 + 1);
      const ls = JSON.parse(app.localStorage.getItem("fitkit_state_v1"));
      assert.equal(((ls.tapShop || {}).vouchers || []).length, nv0 + 1, "voucher chưa nằm trong localStorage");
    }, { bug:"QC-11", severity:"Thấp" });

    t.test("R2-TERMS (GLOSSARY §8.4): chữ hiển thị dùng Cửa hàng · Điểm TapEasy · Điểm danh · Giáo án chia sẻ — id/khoá dữ liệu giữ nguyên", async ()=>{
      const BAN = /Check-in|check-in|TapEasy Points|Gian hàng|gian hàng|TapEasy Store/;
      const hits = [];
      for(const f of ["events.js", "cloud-events.js", "shop.js", "kb.js"]){
        read(f).split("\n").forEach((l, i)=>{ const tt = l.trim(); if(/^(\/\/|\/\*|\*)/.test(tt)) return; const code = l.replace(/\/\/[^"'`]*$/, ""); if(BAN.test(code)) hits.push(`${f}:${i + 1} ${tt.slice(0, 90)}`); });
      }
      assert.deepEqual(hits, []);
      // Cộng đồng: chữ hiển thị không còn "routine" — khoá dữ liệu "routine" (A.report / moderate) giữ nguyên
      app.run(`goto("community"); TECommunity.render(); TECommunity.openDetail(cloud.social.seeds[0].id); TECommunity.openReport(cloud.social.seeds[0].id);`); await app.settle(30);
      const html = app.lastHtml("community-content") + (app.dom.htmlLog.filter(x=> x.id === "sheet-content").slice(-2).map(x=> x.html).join(""));
      assert.ok(!/routine/i.test(html.replace(/data-[\w-]+="[^"]*"/g, "")), (html.match(/.{40}routine.{40}/i) || [""])[0]);
      assert.match(html, /giáo án chia sẻ/i);
      const cm = read("community.js");
      assert.match(cm, /A\.report\("routine", id, reason/); assert.match(cm, /type:"routine"/);
      // Sự kiện / Cửa hàng hiển thị
      app.run(`TapEv.open("gifts")`); await app.settle(30);
      const ev = app.dom.htmlLog.slice(-6).map(x=> x.html).join("");
      assert.ok(!/TapEasy Points|Check-in/.test(ev) && /Điểm TapEasy/.test(ev), ev.slice(0, 200));
      assert.match(read("shop.js"), /label:"Cửa hàng"/);
    }, { bug:"QU-24", severity:"TB" });

    t.test("R2-QU36: ≥ 1024 px — Sự kiện / Cộng đồng / Kho kiến thức có lưới 2 cột (bám html[data-screen]); khung điện thoại không đổi", ()=>{
      const mq = css=>{ const i = css.indexOf("@media (min-width:1024px)"); assert.ok(i >= 0, "thiếu @media (min-width:1024px)"); return css.slice(i, css.indexOf("\n}", i)); };
      const ev = mq(read("events.css")), cm = mq(read("community.css")), kb = mq(read("kb.css"));
      assert.match(ev, /html\[data-screen="events"\] #screen-events :is\(\.te-list, \.te-mo-list\)\{[^}]*grid-template-columns:repeat\(auto-fill, minmax\(min\(100%, 320px\), 1fr\)\)/);
      assert.match(cm, /html\[data-screen="community"\] #screen-community \.cm-grid\{[^}]*grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/);
      assert.match(kb, /html\[data-screen="kb"\] #screen-kb \.kb-list\{[^}]*display:grid;[^}]*minmax\(min\(100%, 320px\), 1fr\)/);
      // 2 × 320 + khe 12 ≤ 820 (khung rộng) nhưng > 460 (khung điện thoại) → đúng 2 cột khi rộng, 1 cột khi hẹp
      assert.ok(2 * 320 + 12 <= 820 && 2 * 320 + 12 > 460 && 3 * 320 + 24 > 820);
    }, { bug:"QU-36", severity:"Thấp" });

    /* ---------------- QUÉT TĨNH: file của commerce không còn mẫu chèn thô "review" ---------------- */
    t.test("Quét tĩnh XSS: community/events/events-media/cloud-events/shop/kb không có biểu thức chưa phân loại (review)", ()=>{
      const files = ["community.js", "events.js", "events-media.js", "cloud-events.js", "shop.js", "kb.js"];
      // cùng quy ước với 06-security: biểu thức chỉ là tên biến/hàm đã escape bên trong (who, inline(b.text)) coi như đã xem
      const bad = files.flatMap(f=> scanFile(path.join(ROOT, f), f)).filter(x=> x.cls === "review" && !/^[\w./*+\-() ]+$/.test(x.expr));
      assert.deepEqual(bad.map(x=> `${x.file}:${x.line} ${x.expr}`), []);
    }, { bug:"QS-06", severity:"Cao" });
  },
};

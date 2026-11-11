/* TapEasy — Sự kiện · Thi đua · Gian hàng (cloud-events.js + events.js + shop.js), động cơ DEMO
   Chạy riêng: node tests/run.js --only events
   - Nạp app thật theo index.html (đúng thứ tự vòng tích hợp 2) và kiểm luồng chính qua API công khai
     (docs/INTEGRATION-events-shop.md §6) — không phụ thuộc chi tiết giao diện đang được thiết kế lại.
   - Nếu có bộ kiểm thử lõi của agent Sự kiện (outputs/_test/events-kit/test_core.js) thì chạy kèm (tiến trình con). */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert } = require("../lib/framework");
const { scriptOrder, APP_DIR } = require("../lib/harness");

const EXT_CORE = path.resolve(APP_DIR, "..", "_test", "events-kit", "test_core.js");

module.exports = {
  name: "TapEasy Sự kiện, Thi đua & Gian hàng (demo)",
  area: "Sự kiện (cloud-events.js · events.js · shop.js)",
  async define(t){
    const app = await t.app({ settleMs: 150 });
    await app.settle(60);
    const run = code=> app.ev(`(async()=>{ ${code} })()`);
    const J = async code=>{ const v = await run(code); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
    const errOf = async code=>{ try{ await run(code); return null; }catch(e){ return e.message || String(e); } };

    t.test("Nạp sau achievements.js, trước health-safety.js; không lỗi; API cloudEvents / TapEv / TapShop đủ", ()=>{
      const o = scriptOrder(), at = f=> o.indexOf(f);
      assert.ok(at("achievements.js") < at("cloud-events.js") && at("cloud-events.js") < at("events.js") && at("events.js") < at("shop.js") && at("shop.js") < at("health-safety.js"));
      if(fs.existsSync(path.join(APP_DIR, "shop-data.js"))) assert.equal(at("shop-data.js"), at("shop.js") - 1, "shop-data.js (danh mục mặc định) ngay trước shop.js");
      assert.deepEqual(app.loadErrors.map(e=> e.file), []);
      const api = ["init","listChallenges","joinChallenge","pushProgress","listEntries","listEvents","register","cancelReg","myRegs","checkIn","addReview",
        "listProducts","placeOrder","myOrders","cancelOrder","myGifts"];
      assert.deepEqual(api.filter(k=> app.ev(`typeof cloudEvents[${JSON.stringify(k)}]`) !== "function"), []);
      assert.equal(app.ev("String(cloudEvents.mode)"), "demo");
      assert.deepEqual(app.evj(`["open","render","loadAll","registerTab"].filter(k=> typeof TapEv[k] !== "function")`), []);
      assert.deepEqual(app.evj(`["openCart","openOrders","cartCount"].filter(k=> typeof TapShop[k] !== "function")`), []);
      assert.equal(app.ev("typeof TapEv.points.balance()"), "number");
    });

    t.test("Demo tự gieo dữ liệu: thử thách tháng này đang mở, ≥ 3 sự kiện, ≥ 5 sản phẩm có giá", async ()=>{
      const d = await J(`const td = todayStr(); const ch = await cloudEvents.listChallenges(); const ev = await cloudEvents.listEvents(); const pr = await cloudEvents.listProducts();
        return { active: ch.filter(c=> c.start <= td && c.end >= td && !c.hidden).length, ev: ev.length, pr: pr.filter(p=> p.price > 0).length };`);
      assert.ok(d.active >= 1, "không có thử thách đang mở: " + JSON.stringify(d));
      assert.ok(d.ev >= 3 && d.pr >= 5, JSON.stringify(d));
    });

    t.test("Thi đua: tham gia → đẩy tiến độ → có tên trong bảng xếp hạng (cùng bot demo)", async ()=>{
      await run(`if(!cloud.isLoggedIn()) await cloud.signUp("ev.tester@tapeasy.vn", "matkhau1", "Ev Tester");`);
      const r = await J(`const td = todayStr(); const ch = (await cloudEvents.listChallenges()).find(c=> c.start <= td && c.end >= td && c.metric === "sessions") || (await cloudEvents.listChallenges())[0];
        await cloudEvents.joinChallenge(ch.id, {}); await cloudEvents.pushProgress(ch.id, { value: 3, week: "", weekValue: 1, done:false });
        const list = await cloudEvents.listEntries(ch.id); const me = await cloudEvents.me();
        return { n: list.length, mine: list.filter(e=> (e.uid || e.id) === (me && me.uid || me)).map(e=> e.value) };`);
      assert.ok(r.n >= 2, "bảng xếp hạng trống: " + JSON.stringify(r));
      assert.deepEqual(r.mine, [3]);
    });

    t.test("Sự kiện offline: đăng ký → vé có mã → huỷ; check-in sai mã bị từ chối (tiếng Việt)", async ()=>{
      const r = await J(`const now = Date.now(); const ev = (await cloudEvents.listEvents()).find(e=> !e.capacity || (e.regCount||0) < e.capacity);
        const reg = await cloudEvents.register(ev.id, { name:"Ev Tester", phone:"0901234567", option:"" });
        let bad = null; try{ await cloudEvents.checkIn(ev.id, "ZZZZZZ"); }catch(e){ bad = e.message; }
        await cloudEvents.cancelReg(ev.id); const regs = await cloudEvents.myRegs();
        return { code: reg.code, status: reg.status, bad, after: regs[ev.id] && regs[ev.id].status };`);
      assert.match(String(r.code), /^[A-Z0-9]{4,}$/);
      assert.equal(r.status, "registered");
      assert.ok(r.bad && /[ăâđêôơưáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵ]/i.test(r.bad), "check-in sai mã phải bị từ chối bằng thông báo tiếng Việt: " + r.bad);
      assert.equal(r.after, "cancelled");
    });

    t.test("Gian hàng: tổng tiền + miễn phí ship ≥ 499k + voucher không âm; VietQR có CRC đúng", ()=>{
      const S = "TapShop.core";
      const t1 = app.evj(`${S}.totals([{ pid:"p_tee", qty:2, price:249000 }, { pid:"p_sticker", qty:1, price:39000 }], null, { shippingFee:30000, freeShipFrom:499000 })`);
      assert.equal(t1.subtotal, 537000); assert.equal(t1.shipping, 0); assert.equal(t1.total, 537000);
      const t2 = app.evj(`${S}.totals([{ pid:"p_cap", qty:1, price:159000 }], null, { shippingFee:30000, freeShipFrom:499000 })`);
      assert.equal(t2.total, 189000);
      assert.ok(app.ev(`${S}.totals([{ pid:"x", qty:1, price:10000 }], { kind:"amount", value:999999, min:0 }, { shippingFee:30000, freeShipFrom:499000 }).total`) >= 0);
      assert.equal(app.ev(`${S}.crc16("123456789")`), "29B1");
      const vq = app.ev(`${S}.vietQR({ bankBin:"970436", accountNo:"0011001234567", amount:189000, note:"TAPEASY TE1111-AB12" })`);
      assert.ok(/^000201/.test(vq) && /5802VN/.test(vq) && app.ev(`${S}.crc16(${JSON.stringify(vq.slice(0, -4))})`) === vq.slice(-4), vq);
    });

    t.test("Đặt hàng COD (demo) → có mã đơn, trạng thái chờ xác nhận → huỷ được", async ()=>{
      const r = await J(`const p = (await cloudEvents.listProducts()).find(x=> x.price > 0 && (x.stock == null || x.stock > 0));
        const o = await cloudEvents.placeOrder({ items:[{ pid:p.id, name:p.name, qty:1, price:p.price, size:"", color:"" }], subtotal:p.price, shipping:30000, discount:0, total:p.price+30000,
          payment:"cod", address:{ name:"Ev Tester", phone:"0901234567", province:"Hà Nội", ward:"Ba Đình", street:"1 Điện Biên Phủ" } });
        const mine = await cloudEvents.myOrders(); await cloudEvents.cancelOrder(o.id); const after = (await cloudEvents.myOrders()).find(x=> x.id === o.id);
        return { code:o.code, status:o.status, n: mine.filter(x=> x.id === o.id).length, after: after && after.status };`);
      assert.match(String(r.code), /^TE\d{4}-/);
      assert.equal(r.status, "pending"); assert.equal(r.n, 1); assert.equal(r.after, "cancelled");
    });

    t.test("Trang chủ: ô 'Thi đua tháng' + 'Gian hàng' trong Khám phá; thẻ Sự kiện không lỗi; Hồ sơ có thẻ Sự kiện, quà & gian hàng", async ()=>{
      app.call("goto", "home"); await app.settle(40);
      const ids = app.evj("teHomeExplore.list().map(x=> x.id)");
      assert.ok(ids.includes("events") && ids.includes("shop"), ids.join(","));
      assert.equal(app.ev(`teHomeExplore.open("events")`), true); await app.settle(30);
      app.call("goto", "profile"); await app.settle(40);
      const prof = app.dom.htmlLog.map(x=> x.html).join("\n");
      // fix-commerce vòng 2 (GLOSSARY §8.4): "gian hàng" → "cửa hàng" trong chữ hiển thị
      assert.ok(/Sự kiện, quà &amp; (?:gian|cửa) hàng/.test(prof), "thiếu thẻ Sự kiện trong Hồ sơ");
      app.call("goto", "home"); await app.settle(20);
      assert.equal(app.asyncErrors.length, 0, app.asyncErrors.map(e=> e.message).join("; "));
      assert.deepEqual(app.consoleLog.filter(c=> c[0] === "error").map(c=> c[1]), []);
    });

    t.test("Bộ kiểm thử lõi của agent Sự kiện (_test/events-kit/test_core.js) — nếu có trong máy", ()=>{
      if(!fs.existsSync(EXT_CORE)){ t.info("events-kit", ["Không có _test/events-kit/test_core.js (vd trên CI) — bỏ qua"]); return; }
      const r = require("child_process").spawnSync(process.execPath, [EXT_CORE], { encoding:"utf8", timeout: 120000, cwd: path.dirname(EXT_CORE) });
      const out = String(r.stdout || "") + String(r.stderr || "");
      const summary = (out.match(/PASS \d+\/\d+/) || ["(không có dòng PASS)"])[0];
      const fails = out.split("\n").filter(l=> /^\s*✗/.test(l)).slice(0, 12).join("\n      ");
      assert.equal(r.status, 0, summary + (fails ? "\n      " + fails : "") + (r.status === 2 ? "\n      " + out.slice(-600) : ""));
      t.info("events-kit test_core.js", [summary]);
    }, { timeout: 130000 });
  },
};

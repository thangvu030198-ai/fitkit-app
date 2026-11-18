/* 19/11/2026 — Thanh hiệp đang tập (session-focus.js) */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
module.exports = {
  name: "Màn tập gọn: thanh hiệp hiện tại ở đáy (−/+ kg, lần, XONG HIỆP)",
  area: "session-focus.js",
  async define(t){
    const app = await t.app();
    t.test("FOCUS-01: module đã nạp, bước tạ hợp lệ", ()=>{
      assert.equal(app.ev(`typeof FKFocus`), "object");
      assert.ok(app.ev(`FKFocus.STEPS.includes(FKFocus.kgStep)`));
    });
    t.test("FOCUS-02: được nạp sau session-plus.js và có trong cache offline", ()=>{
      const root = path.join(__dirname, "..", "..");
      const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");
      assert.ok(idx.indexOf("session-focus.js") > idx.indexOf("session-plus.js"));
      assert.ok(/session-focus\.js/.test(fs.readFileSync(path.join(root, "sw.js"), "utf8")));
      assert.ok(/session-focus\.js/.test(fs.readFileSync(path.join(root, "scripts", "prepare-www.sh"), "utf8")));
    });
    t.test("FOCUS-03: chỉ điều khiển ô/nút sẵn có (không tự lưu dữ liệu riêng)", ()=>{
      const src = fs.readFileSync(path.join(__dirname, "..", "..", "session-focus.js"), "utf8");
      assert.ok(/querySelector\("\[data-done\]"\)/.test(src) && /dispatchEvent\(new Event\("change"/.test(src));
      assert.ok(!/state\.|saveState|store\(\)/.test(src));
    });
  }
};

/* 19/11/2026 — Thẻ "Đang tập" im lặng ở màn hình khoá (session-live.js) */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
const read = f=> fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
module.exports = {
  name: "Thẻ Đang tập (Android): im lặng, chỉ khi có buổi, tự xoá khi quay lại",
  area: "session-live.js",
  async define(t){
    const app = await t.app();
    t.test("LIVE-01: không có buổi tập → không đăng; bản web không gọi plugin", async ()=>{
      assert.equal(app.ev(`typeof FKLive`), "object");
      assert.equal(app.evj(`FKLive.text()`), null);
      assert.equal(await app.ev(`FKLive.post()`), false);
    });
    t.test("LIVE-02: kênh mức thấp (không kêu/rung), id riêng khác báo hết nghỉ (900), chỉ Android", ()=>{
      const s = read("session-live.js");
      assert.ok(/importance: 2/.test(s) && /vibration: false/.test(s) && /ID = 901/.test(s) && /getPlatform\(\) === "android"/.test(s));
      assert.ok(/display !== "granted"\) return false/.test(s), "không xin quyền khi app đang ẩn");
      assert.ok(/visibilityState === "hidden"\) post\(\); else clear\(\)/.test(s));
    });
    t.test("LIVE-03: nạp sau session-focus.js và có trong cache offline / bản store", ()=>{
      const idx = read("index.html");
      assert.ok(idx.indexOf("session-live.js") > idx.indexOf("session-focus.js"));
      assert.ok(/session-live\.js/.test(read("sw.js")) && /session-live\.js/.test(read("scripts/prepare-www.sh")));
    });
  }
};

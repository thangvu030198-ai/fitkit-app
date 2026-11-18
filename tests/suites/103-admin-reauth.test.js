/* 19/11/2026 — Đăng nhập bảng quản trị: xác thực lại theo MỌI cách đăng nhập (mật khẩu / Google / Apple), không chỉ providerData[0] */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
const read = f=> fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
module.exports = {
  name: "Quản trị: xác thực lại đúng cách đăng nhập (mật khẩu / Google / Apple)",
  area: "cloud.js, rbac.js, admin.js",
  async define(t){
    t.test("AR-01: cloud.reauth có, lỗi sai mật khẩu báo tiếng Việt", ()=>{ const s = read("cloud.js");
      assert.ok(/api\.reauth = wrap\(/.test(s)); assert.ok(/"auth\/reauth-wrong":/.test(s)); assert.ok(/"auth\/no-password":/.test(s)); assert.ok(/socialCredentialSignIn\(k, u\)/.test(s)); });
    t.test("AR-02: rbac.reauth dùng cloud.reauth — không còn providerData[0] + popup", ()=>{ const s = read("rbac.js");
      assert.ok(/cloud\.reauth\(pw, kind\)/.test(s)); assert.ok(!/fu\.providerData\[0\]/.test(s)); assert.ok(!/reauthenticateWithPopup/.test(s)); });
    t.test("AR-03: màn đăng nhập quản trị có nút Google/Apple + quên mật khẩu", ()=>{ const s = read("admin.js");
      assert.ok(/data-adm="login-social"/.test(s)); assert.ok(/"reset-pw":/.test(s)); assert.ok(/function authWays\(\)/.test(s)); });
  }
};

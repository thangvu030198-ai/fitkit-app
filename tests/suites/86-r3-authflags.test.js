/* R3.1 — công tắc đăng nhập do quản trị bật/tắt (cloud.authFlags) */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const read = f=> fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
module.exports = {
  name: "R3.1 — Công tắc đăng nhập & xác minh (authFlags)",
  area: "cloud.js, pt.js, admin.js, firestore.rules",
  define(t){
    t.test("AF-01: mặc định OTP SMS và OTP email TẮT; quản trị bật lại được và tắt lại được", async ()=>{
      const app = await t.app({ state: false });
      assert.equal(app.ev("cloud.authFlags.get().phoneOtp"), false);
      assert.equal(app.ev("cloud.authFlags.get().emailOtp"), false);
      assert.equal(app.ev("cloud.phone.enabled()"), false);
      await app.ev("cloud.authFlags.save({ emailOtp: true })");
      assert.equal(app.ev("cloud.otp.enabled()"), true, "bật OTP email");
      assert.equal(app.ev("cloud.phone.enabled()"), false, "SMS vẫn tắt");
      await app.ev("cloud.authFlags.save({ phoneOtp: true })");
      assert.equal(app.ev("cloud.phone.enabled()"), true);
      await app.ev("cloud.authFlags.save({ phoneOtp: false, emailOtp: false })");
      assert.equal(app.ev("cloud.phone.enabled()"), false); assert.equal(app.ev("cloud.otp.enabled()"), false);
    });
    t.test("AF-02: chỉ nhận cờ boolean đã biết (bỏ trường lạ / sai kiểu)", async ()=>{
      const app = await t.app({ state: false });
      await app.ev("cloud.authFlags.save({ phoneOtp: 'yes', hack: true, facebook: true })");
      const f = app.ev("JSON.stringify(cloud.authFlags.get())");
      assert.ok(!/hack/.test(f)); assert.equal(JSON.parse(f).phoneOtp, false); assert.equal(JSON.parse(f).facebook, true);
    });
    t.test("AF-03: rules — settings/auth ai cũng đọc được, chỉ settings.edit ghi, chỉ cờ bool; Admin có thẻ công tắc; pt.js áp lại khi đổi", ()=>{
      const r = read("firestore.rules");
      assert.match(r, /match \/settings\/auth \{\s*allow read: if true;\s*allow create, update: if hasPerm\('settings\.edit'\)/);
      assert.match(r, /hasOnly\(\['emailOtp', 'phoneOtp', 'facebook', 'apple', 'google', 'updatedAt', 'updatedBy'\]\)/);
      assert.match(r, /doc != 'public' && doc != 'auth' && hasPerm\('settings\.edit'\)/);
      const a = read("admin.js"); assert.match(a, /data-adm-authflag=/); assert.match(a, /"authflags-save"/); assert.match(a, /cloud\.authFlags\.save\(f\)/);
      assert.match(read("pt.js"), /addEventListener\("fk:authflags"/);
    });
  }
};

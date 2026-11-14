/* Vòng R3 — ux: lớp dịch FK_I18N + đóng gói (index.html / sw.js) */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");

function loadI18n(){
  const W = { localStorage:{ getItem(){ return null; }, setItem(){} }, navigator:{ language:"vi-VN" } };
  W.window = W; W.globalThis = W;
  const run = f=> new Function("window", "globalThis", "FK_I18N", read(f))(W, W, W.FK_I18N);
  run("i18n.js");
  fs.readdirSync(ROOT).filter(f=> /^i18n-en[\w-]*\.js$/.test(f)).sort().forEach(run);
  return W.FK_I18N;
}

module.exports = {
  name: "Vòng R3 — Đổi ngôn ngữ & đóng gói (r3-ux)",
  area: "i18n.js, i18n-en*.js, index.html, sw.js",
  define(t){
    const I = loadI18n();
    t.test("R3-UX-I18N-01: từ điển Anh nạp được, ≥ 4.000 mục", ()=>{
      assert.ok(I && typeof I.t === "function");
      assert.ok(I.size("en") >= 4000, "số mục: " + I.size("en"));
    });
    t.test("R3-UX-I18N-02: dịch đúng chuỗi lõi (điều hướng, đăng nhập, cửa hàng trống)", ()=>{
      const want = { "Trang chủ":"Home", "Tập luyện":"Workout", "Dinh dưỡng":"Nutrition", "Hồ sơ":"Profile", "Đăng nhập":"Log in", "Lưu":"Save",
        "Quên mật khẩu?":"Forgot password?", "Chưa có sản phẩm nào mở bán":"No products on sale yet" };
      for(const k in want) assert.strictEqual(I.t(k, "en"), want[k], k);
    });
    t.test("R3-UX-I18N-03: mẫu có biến số + tên bài tập dạng \"Việt (English)\"", ()=>{
      assert.strictEqual(I.t("Tuần 3", "en"), "Week 3");
      assert.strictEqual(I.t("12 buổi", "en"), "12 sessions");
      assert.strictEqual(I.t("Squat tạ đòn (Barbell Squat)", "en"), "Barbell Squat");
    });
    t.test("R3-UX-I18N-04: chuỗi không có bản dịch giữ nguyên; tiếng Việt trả nguyên văn; translate() trả null", ()=>{
      const s = "Chuỗi lạ không có trong từ điển xyz";
      assert.strictEqual(I.t(s, "en"), s);
      assert.strictEqual(I.translate(s, "en"), null);
      assert.strictEqual(I.t("Trang chủ", "vi"), "Trang chủ");
    });
    t.test("R3-UX-I18N-05: không dịch nội dung người dùng (textarea, contenteditable, data-no-i18n) — khai báo trong mã", ()=>{
      const src = read("i18n.js");
      assert.match(src, /TEXTAREA:1/); assert.match(src, /data-no-i18n/); assert.match(src, /contenteditable/i);
      assert.match(src, /WeakMap/, "phải lưu bản gốc để đổi lại tiếng Việt");
    });
    t.test("R3-UX-I18N-06: mọi file từ điển được khai báo ở i18n.js, index.html và sw.js", ()=>{
      const files = fs.readdirSync(ROOT).filter(f=> /^i18n-en[\w-]*\.js$/.test(f));
      const src = read("i18n.js"), html = read("index.html"), sw = read("sw.js");
      for(const f of files){ assert.ok(src.includes('"' + f + '"'), "i18n.js thiếu " + f); assert.ok(html.includes('src="' + f + '"'), "index.html thiếu " + f); assert.ok(sw.includes('"./' + f + '"'), "sw.js thiếu " + f); }
      assert.match(html, /<script src="i18n\.js"><\/script>/);
    });
    t.test("R3-UX-PWA-01: sw.js báo bản mới + precache bỏ qua HTTP cache + có giới hạn cache chạy-lúc-dùng", ()=>{
      const sw = read("sw.js");
      assert.match(sw, /FK_SW_ACTIVATED/); assert.match(sw, /cache:"reload"/); assert.match(sw, /function trimRuntime/);
      assert.match(sw, /const CACHE = "fitkit-v(2[3-9]|[3-9]\d)"/);
    });
    t.test("R3 (chuyển giao): nhật ký ăn có dòng null không làm hỏng thẻ calo Trang chủ / normalizeState", ()=>{
      assert.match(read("ui-signature.js"), /if\(!i \|\| typeof i !== "object"\) return; tot\.kcal/);
      assert.match(read("app.js"), /day\[m\] = day\[m\]\.filter\(isObj\)/);
    });
    t.test("R3-store (chuyển giao): bản store ẩn mục \"Sắp ra mắt\" ở màn chọn vai trò", ()=>{
      assert.match(read("pt.js"), /filter\(r=> !\(r\.soon && window\.FK_BUILD && FK_BUILD\.store\)\)/);
    });
  }
};

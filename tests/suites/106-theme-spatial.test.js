/* 19/11/2026 — gói giao diện "Spatial": kính nổi trên nền phòng tập (themes.js · theme-packs.css · theme-accent.css)
   Chỉ đổi giao diện: bố cục/thông tin của app giữ nguyên (không thêm DOM, chỉ token + luật CSS + biến ảnh nền). */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
module.exports = {
  name: "Gói giao diện Spatial",
  area: "themes.js / theme-packs.css",
  async define(t){
    const app = await t.app();
    t.test("SPA-01: đăng ký gói Spatial (tối, có ảnh xem trước, font Manrope) và áp được", ()=>{
      const d = app.evj(`(()=>{ const x = fkTheme.byId("spatial"); return { id:x.id, name:x.name, pack:!!x.pack, photo:!!x.photo, mode:x.mode || "dark", fonts:x.fonts, pv:!!x.pv }; })()`);
      assert.deepEqual(d, { id:"spatial", name:"Spatial", pack:true, photo:true, mode:"dark", fonts:["Manrope:wght@400;500;600;700;800"], pv:true });
      app.run(`fkTheme.set("spatial")`);
      const r = app.evj(`({ th:document.documentElement.getAttribute("data-theme"), tp:document.documentElement.classList.contains("tp-pack"),
        dark:document.documentElement.classList.contains("fk-dark"), st:state.theme })`);
      assert.deepEqual(r, { th:"spatial", tp:true, dark:true, st:"spatial" });
    });
    t.test("SPA-02: ảnh nền phòng tập gán lúc chạy qua --tp-photo (từ MEDIA_CONFIG), đổi gói khác thì gỡ", ()=>{
      // DOM shim không lưu style → gắn spy vào setProperty/removeProperty của <html>
      const log = app.evj(`(()=>{ const st = document.documentElement.style, L = window.__photoLog = [];
        st.setProperty = (k, v)=> L.push(["set", k, v]); st.removeProperty = k=> L.push(["rm", k]);
        fkTheme.set("spatial"); fkTheme.set("navy"); return L.filter(x=> x[1] === "--tp-photo"); })()`);
      assert.equal(log[0][0], "set"); assert.match(log[0][2], /^url\("[^"()\s]+welcome[^"()\s]*"\)$/);
      assert.deepEqual(log[log.length - 1], ["rm", "--tp-photo"]);
      const css = read("theme-packs.css");
      assert.match(css, /var\(--tp-photo, linear-gradient\(/, "có gradient dự phòng khi thiếu ảnh / ngoại tuyến");
    });
    t.test("SPA-03: token đặc trưng + chip/tab chọn trắng + máy yếu bỏ kính + giảm trong suốt", ()=>{
      const css = read("theme-packs.css"), acc = read("theme-accent.css");
      assert.match(css, /:root\[data-theme="spatial"\]\{[\s\S]*--glass-blur:blur\(26px\) saturate\(135%\);[\s\S]*--font-ui:'Manrope'/);
      assert.match(acc, /:root\[data-theme="spatial"\]\{[\s\S]*--accent:#7EE8D0;[\s\S]*--cta-fg:#0F3B36;/);
      assert.match(css, /html\[data-theme="spatial"\] :is\(\.pill\.active, \.pill\.hot, \.choice-card\.selected, \.pb-opt\.on, [^)]*\)\{\s*background:#FFFFFF !important; color:#1B1D19/);
      assert.match(css, /html\.lowfx\[data-theme="spatial"\][^{]*\{\s*-webkit-backdrop-filter:none !important; backdrop-filter:none !important;/);
      assert.match(css, /prefers-reduced-transparency: reduce\)\{\s*html\[data-theme="spatial"\]/);
      assert.ok(read("i18n-en.js").includes('"Kính nổi · nền phòng tập · nhấn bạc hà"'), "có bản tiếng Anh");
    });
  }
};

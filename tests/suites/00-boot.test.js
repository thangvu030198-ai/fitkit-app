/* Nạp toàn bộ script theo thứ tự index.html + khởi động appBoot() + smoke render mọi màn */
"use strict";
const { assert } = require("../lib/framework");
const { scriptOrder } = require("../lib/harness");

module.exports = {
  name: "Khởi động & smoke test giao diện",
  area: "Khởi động (index.html, pt.js appBoot, app.js init)",
  async define(t){
    const app = await t.app();
    const order = scriptOrder();

    t.test(`index.html nạp ${order.length} script cục bộ đúng thứ tự brief`, ()=>{
      const core = ["icons.js","firebase-config.js","media-config.js","cloud.js","data.js","templates.js","exdb.js","app.js","meals.js","nutrition.js","freevideos.js","video.js","library.js","coach.js","ptprofile.js","pt.js"];
      assert.deepEqual(order.filter(f=> core.includes(f)), core, "thứ tự script lõi");
      const at = f=> order.indexOf(f);
      // themes.js nạp trong <head> (trước script lõi) để áp theme trước khi vẽ → không nháy màu
      assert.ok(at("themes.js") >= 0 && at("themes.js") < at("icons.js"), "themes.js phải ở <head>, trước icons.js");
      assert.equal(at("meals-extra.js"), at("meals.js") + 1, "meals-extra.js ngay sau meals.js");
      const modules = ["ui-kit.js","exdb-vi-1.js","exdb-vi-2.js","exdb-vi-3.js","exdb-vi.js","nutrition-pro.js","training-pro.js","program-builder.js","pt-pro.js",
        "cloud-social.js","pt-connect.js","community.js","achievements.js","cloud-events.js","events.js","shop.js",
        /* vòng 3 */ "cloud-pt-directory.js","findpt.js","events-media.js","shop-data.js","kb-data-1.js","kb-data-6.js","kb.js","cloud-admin.js","admin.js","health-safety.js"];
      for(const m of modules) assert.ok(at(m) > at("pt.js"), `${m} phải nạp sau pt.js`);
      assert.equal(at("ui-kit.js"), at("pt.js") + 1, "ui-kit.js ngay sau pt.js (module sau dùng fkEmpty/fkError)");
      assert.ok(at("exdb-vi.js") > at("exdb-vi-3.js") && at("exdb-vi-1.js") > at("library.js"), "dữ liệu exdb-vi trước exdb-vi.js, sau exdb/library");
      // vòng 2: PT Connect + Cộng đồng sau pt-pro.js (bọc renderClientForm ngoài lớp pt-pro); Sự kiện/Gian hàng sau achievements.js
      assert.ok(at("pt-pro.js") < at("cloud-social.js") && at("cloud-social.js") < at("pt-connect.js") && at("pt-connect.js") < at("community.js"), "cloud-social → pt-connect → community, sau pt-pro");
      assert.ok(at("achievements.js") < at("cloud-events.js") && at("cloud-events.js") < at("events.js") && at("events.js") < at("shop.js"), "cloud-events → events → shop, sau achievements");
      assert.equal(order[order.length-1], "health-safety.js", "health-safety.js phải nạp CUỐI");
      // vòng 3: rbac.js NGAY sau cloud.js (trước app.js — vô hiệu state.isAdmin cũ trước khi state nạp)
      assert.equal(order[at("cloud.js") + 1], "rbac.js", "rbac.js ngay sau cloud.js");
    });
    t.test("index.html: CSS theo đúng thứ tự (style → themes → … module … → brand → themes-modules) + thương hiệu TapEasy", ()=>{
      const html = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "index.html"), "utf8");
      const css = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(m=> m[1]).filter(h=> !/^https?:/.test(h));
      assert.equal(css[0], "style.css"); assert.equal(css[1], "themes.css");
      assert.equal(css.indexOf("brand.css"), css.length - 2, "brand.css: sau themes.css + CSS module, ngay trước themes-modules.css");
      assert.equal(css[css.length-1], "themes-modules.css");
      for(const c of ["ui-kit.css","nutrition-pro.css","training-pro.css","program-builder.css","pt-pro.css","pt-connect.css","community.css","achievements.css","health-safety.css","events.css","shop.css",
        /* vòng 3 */ "findpt.css","kb.css","admin.css"]) assert.ok(css.includes(c), "thiếu " + c);
      assert.ok(css.indexOf("pt-pro.css") < css.indexOf("pt-connect.css") && css.indexOf("pt-connect.css") < css.indexOf("community.css") && css.indexOf("community.css") < css.indexOf("achievements.css"), "pt-connect.css, community.css sau pt-pro.css");
      assert.ok(css.indexOf("health-safety.css") < css.indexOf("events.css") && css.indexOf("events.css") < css.indexOf("shop.css"), "events.css, shop.css sau health-safety.css");
      assert.match(html, /<title>TapEasy/);
      assert.ok(!/FIT ?KIT|FitKit/.test(html.replace(/<!--[\s\S]*?-->/g, "")), "index.html còn chữ thương hiệu cũ");
    });
    for(const f of order){
      t.test(`nạp ${f} không ném lỗi`, ()=>{
        const e = app.loadErrors.find(x=> x.file === f);
        assert.ok(!e, e && (e.error.stack || String(e.error)));
      });
    }
    t.test("appBoot(): người dùng đã đăng nhập + onboard → vào Trang chủ, đóng lớp #auth", async ()=>{
      await app.settle(30);
      assert.ok(app.dom.registry.get("screen-home").classList.contains("active"), "#screen-home chưa active");
      assert.ok(!app.dom.registry.get("auth").classList.contains("open"), "#auth vẫn mở");
      assert.ok(app.lastHtml("home-content").length > 500, "Trang chủ chưa render");
      assert.equal(app.ev("cloud.mode"), "demo");
    });
    t.test("Khởi động không có console.error / promise lỗi", ()=>{
      const errs = app.consoleLog.filter(c=> c[0] === "error").map(c=> c[1]).concat(app.asyncErrors.map(e=> e.stack || String(e)));
      assert.deepEqual(errs, []);
    });
    t.test("Lần đầu mở app (chưa có state) → hiện màn chào, không lỗi", async ()=>{
      const a2 = await t.app({ state:false });
      await a2.settle(30);
      assert.ok(a2.dom.registry.get("auth").classList.contains("open"));
      assert.ok(a2.lastHtml("auth-body").length > 200);
      assert.equal(a2.asyncErrors.length, 0);
      assert.equal(a2.ev("state.onboarded"), false);
    });
    t.test("Dữ liệu localStorage hỏng (JSON lỗi) → app tự về state mặc định, không crash", async ()=>{
      const a3 = await t.app({ storage:{ fitkit_state_v1:"{hỏng" }, state:false });
      assert.equal(a3.loadErrors.length, 0);
      assert.equal(a3.ev("typeof state.plans"), "object");
    });
    const screens = ["home","workout","nutrition","coach","profile","plans","library","progress","exlib","sleep","reminders"];
    t.test(`goto() qua ${screens.length} màn không ném lỗi`, async ()=>{
      const bad = [];
      for(const s of screens){ try{ app.call("goto", s); await app.settle(5); }catch(e){ bad.push(`${s}: ${e.message}`); } }
      assert.deepEqual(bad, []);
    });
    const sheets = ["openTemplateBrowser()","openTemplateDetail(PROGRAM_TEMPLATES[0].id)","startSession('T2')","openMediaSettings()","openJoinSheet()",
      "openAddClientSheet()","openDriveSettings()","openAiSettings()","openEditNutritionTargets()","openAddFood('lunch')","openQuickAddMeal()",
      "openRecipe(RECIPES[0].id)","openExerciseHistory('benchpress','Bench Press')","openAddInbodyLog()","openDeleteAccountSheet()","openPrivacySheet()","openCreditsSheet()"];
    t.test(`Mở ${sheets.length} bảng trượt (sheet) chính không ném lỗi`, async ()=>{
      const bad = [];
      for(const s of sheets){ try{ app.run(s); await app.settle(5); app.call("closeSheet"); }catch(e){ bad.push(`${s}: ${e.message}`); } }
      assert.deepEqual(bad, []);
      assert.equal(app.asyncErrors.length, 0, app.asyncErrors.map(e=> e.message).join("; "));
    });
  },
};

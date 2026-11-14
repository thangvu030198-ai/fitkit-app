/* Tích hợp 10 module + bản sửa 19 bug QA + đổi thương hiệu TapEasy (vòng tích hợp 11/11/2026)
   - Module mở rộng nạp đủ, mở được màn/sheet chính, không lỗi JS
   - Hồi quy cho các bản sửa: toast/safeUrl/richText, thực đơn dự phòng (meals.js), khởi động thanh đòn,
     Firestore rules + cloud.js (email, joinByCode, Apple revoke), đóng gói (sw.js, prepare-www.sh)
   - Thương hiệu: không còn chữ "FIT KIT" hiển thị, logo trỏ đúng assets/brand/… */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert, expectNone } = require("../lib/framework");
const { scriptOrder, APP_DIR } = require("../lib/harness");

const PROFILES = [
  { key:"nam-25-tang-co",    gender:"male",   age:25, height:172, weight:68,  activity:"moderate",   goal:"gain" },
  { key:"nam-30-giam-mo",    gender:"male",   age:30, height:175, weight:85,  activity:"light",      goal:"lose" },
  { key:"nam-45-to-tang-co", gender:"male",   age:45, height:180, weight:95,  activity:"active",     goal:"gain" },
  { key:"nam-16-giam-mo",    gender:"male",   age:16, height:168, weight:75,  activity:"moderate",   goal:"lose" },
  { key:"nu-30-giam-mo",     gender:"female", age:30, height:162, weight:68,  activity:"moderate",   goal:"lose" },
  { key:"nu-28-vdv-tang-co", gender:"female", age:28, height:170, weight:60,  activity:"veryActive", goal:"gain" },
  { key:"nu-55-nho-giam-mo", gender:"female", age:55, height:150, weight:48,  activity:"sedentary",  goal:"lose" },
];
const MEAT_IDS = new Set(["uc-ga","dui-ga","uc-vit","thit-bo-nac","thit-heo-nac","thit-heo-ba-chi","ca-hoi","ca-basa","ca-ngu","tom-luoc",
  "ca-thu","muc","thit-bo-xay","dui-ga-bo-da","thit-heo-xay","pho-bo-to","bun-bo-hue-to","hu-tieu-to","mi-quang-to","bun-cha-suat",
  "com-tam-suon","com-van-phong","com-chien","banh-mi-thit","xoi-man","banh-cuon-dia","banh-xeo","banh-bao","chao-ga-to","goi-cuon-san"]);
const OLD_BRAND = /FIT ?KIT/;

module.exports = {
  name: "Tích hợp module · hồi quy bản sửa bug · thương hiệu TapEasy",
  area: "Tích hợp (index.html, sw.js, prepare-www.sh, 10 module, cloud.js, meals.js, firestore.rules)",
  async define(t){
    const app = await t.app();
    await app.settle(40);
    const read = f => fs.readFileSync(path.join(APP_DIR, f), "utf8");

    /* ---------- 1. Module mở rộng ---------- */
    t.test("10 module đã nạp & công khai API: FKAch, FKHealth, PB, NutriPro, FKTP, PTP, exdbVi, fkTheme, fkEmpty…", ()=>{
      const types = app.evj(`({ FKAch: typeof FKAch, FKHealth: typeof FKHealth, PB: typeof PB, NutriPro: typeof NutriPro, FKTP: typeof FKTP, PTP: typeof PTP,
        exdbVi: typeof exdbVi, fkTheme: typeof fkTheme, fkEmpty: typeof fkEmpty, openProgramBuilder: typeof openProgramBuilder, openHealthSafety: typeof openHealthSafety,
        EXDB_VI: typeof EXDB_VI })`);
      const bad = Object.entries(types).filter(([, v])=> v === "undefined").map(([k])=> k);
      expectNone(bad, "Thiếu API module");
      assert.ok(app.ev("Object.keys(EXDB_VI).length") >= 800, "exdb-vi: chưa đủ bản dịch");
      assert.ok(app.ev("FOODS.length") >= 140, "meals-extra chưa thêm thực phẩm");
    });
    t.test("Mở các màn/sheet của module không ném lỗi (Thành tích, Tổng kết tuần, Tạo giáo án, Sức khoẻ, Đi chợ, Nhật ký buổi, Lịch PT, Doanh thu)", async ()=>{
      const calls = ["FKAch.open()","goto('home')","FKAch.openWeekly('last')","openProgramBuilder()","FKHealth.openScreening({ mode:'edit' })","FKHealth.openTipsSheet()","FKHealth.openDisclaimer()",
        "NutriPro.ui.openShoppingList()","FKTP.openLogSheet()","FKTP.openCycleSheet && FKTP.openCycleSheet()","PTP.openCalendar()","PTP.openRevenue()","openHealthSafety()"];
      const bad = [];
      for(const c of calls){ try{ app.run(c); await app.settle(5); app.call("closeSheet"); await app.settle(2); }catch(e){ bad.push(`${c}: ${e.message}`); } }
      expectNone(bad, "Lỗi khi mở màn module");
      assert.equal(app.asyncErrors.length, 0, app.asyncErrors.map(e=> e.message).join("; "));
    });
    t.test("Màn chính sau tích hợp (Trang chủ, Tập luyện, Dinh dưỡng, PT, Hồ sơ, Tiến trình) render được với mọi module", async ()=>{
      const bad = [];
      for(const s of ["home","workout","nutrition","coach","profile","progress","plans","exlib","sleep","reminders","home"]){
        try{ app.call("goto", s); await app.settle(5); }catch(e){ bad.push(`${s}: ${e.message}`); }
      }
      expectNone(bad, "Lỗi render màn");
      assert.ok(app.lastHtml("home-content").length > 500);
      const errs = app.consoleLog.filter(c=> c[0] === "error").map(c=> c[1].slice(0, 160));
      expectNone(errs, "console.error");
    });
    t.test("Buổi tập end-to-end với module (training-pro + achievements + health-safety bọc startSession/finishSession)", async ()=>{
      app.run(`state.selectedDay = Object.keys(getActivePlan().days).find(k=> getActivePlan().days[k].items.length) || "T2";`);
      app.run(`startSession(state.selectedDay)`); await app.settle(5);
      const ok = app.ev("typeof session === 'object' && session !== null");
      if(ok){ try{ app.run("finishSession && finishSession()"); }catch(e){ throw new Error("finishSession: " + e.message); } }
      app.call("closeSheet");
      assert.equal(app.asyncErrors.length, 0, app.asyncErrors.map(e=> e.message).join("; "));
    });

    /* ---------- 2. Hồi quy bản sửa ---------- */
    t.test("BUG-01: toast() escape cả icon lẫn nội dung đúng 1 lần — kể cả khi module gọi toast(esc(…)) (vòng 2: toast giải mã thực thể trước)", ()=>{
      app.call("toast", "A & B <i>", '"><img src=x onerror=alert(1)>');
      const h = app.lastHtml("toast");
      assert.ok(!/<img|<i>/.test(h), h);
      assert.ok(h.includes("A &amp; B &lt;i&gt;") && !h.includes("&amp;amp;"), h);
      // module (pt-connect, community, events, shop) gọi toast(esc(x)) → vẫn hiện đúng chữ gốc, không chạy HTML
      app.call("toast", app.call("escapeHtml", `Lan & "Minh" <svg onload=alert(1)>`));
      const h2 = app.lastHtml("toast");
      assert.ok(h2.includes("Lan &amp; &quot;Minh&quot; &lt;svg onload=alert(1)&gt;") && !/&amp;(amp|quot|lt);/.test(h2) && !/<svg/.test(h2), h2);
      app.call("toast", "&lt;img src=x onerror=alert(1)&gt;");
      assert.ok(!/<img/.test(app.lastHtml("toast")), "giải mã thực thể không được tạo thẻ thật");
      const dbl = scriptOrder().flatMap(f=> read(f).split("\n").map((l, i)=> /toast\(\s*esc\(/.test(l) ? `${f}:${i+1}` : null).filter(Boolean));
      t.info("toast(esc(…)) còn trong module (vô hại từ vòng 2 — nên bỏ esc khi module sửa tiếp)", dbl);
    });
    t.test("BUG-02: safeUrl/attrUrl chỉ nhận http(s), ảnh data:image base64, đường dẫn nội bộ; richText chỉ cho <b>/<br>", ()=>{
      const S = u=> app.call("safeUrl", u);
      assert.equal(S("javascript:alert(1)"), ""); assert.equal(S(" JavaScript:alert(1)"), ""); assert.equal(S("data:text/html,<script>"), "");
      assert.equal(S("vbscript:x"), ""); assert.equal(S("x\" onerror=\"alert(1)"), "");
      assert.equal(S("https://a.b/c.jpg"), "https://a.b/c.jpg"); assert.equal(S("data:image/jpeg;base64,/9j/4AAQ"), "data:image/jpeg;base64,/9j/4AAQ");
      assert.equal(S("assets/brand/logo-mark.svg"), "assets/brand/logo-mark.svg");
      assert.equal(app.call("safeUrl", "blob:https://x/1", { noBlob:true }), "");
      assert.equal(app.call("attrUrl", 'https://x/a"b'), "https://x/a&quot;b");
      assert.equal(app.call("richText", "tăng <b>2,5 kg</b><script>x</script>"), "tăng <b>2,5 kg</b>&lt;script&gt;x&lt;/script&gt;");
    });
    t.test("BUG-05/06/14 (thực đơn DỰ PHÒNG meals.js khi nutrition-pro lỗi): chay không lùi món mặn, món chính ≤ 600 g, món phụ ≤ 400 g/bữa, calo chay ±10%", ()=>{
      const prof = p => app.run(`(()=>{ state.profile = Object.assign(defaultState().profile, ${JSON.stringify(p)}, { autoTargets:true }); recomputeProfile(); return JSON.parse(JSON.stringify(state.profile)); })()`);
      const bad = [];
      for(const p of PROFILES){
        const r = prof(p);
        for(const cz of ["all","vn","au"]) for(let d = 0; d < 7; d++){
          const plan = app.evj(`buildDayPlanBasic(${JSON.stringify(r)}, ${d}, { veg:true, cuisine:${JSON.stringify(cz)} })`);
          let kcal = 0;
          for(const [meal, x] of Object.entries(plan)){
            kcal += app.call("recipeKcal", x);
            const src = app.evj(`RECIPES.find(z=> z.id === ${JSON.stringify(x.id)})`);
            if(!(src.tags||[]).some(tg=> tg === "chay" || tg === "thuan-chay")) bad.push(`${p.key}/${cz}/d${d}/${meal}: ${x.id} không có tag chay`);
            x.items.forEach(([id])=>{ if(MEAT_IDS.has(id)) bad.push(`${p.key}/${cz}/d${d}/${meal}: chứa ${id}`); });
            const base = app.evj(`scaleRecipe(RECIPES.find(z=> z.id === ${JSON.stringify(x.id)}), ${x.factor})`).items.reduce((s, [, g])=> s + g, 0);
            if(base > 600) bad.push(`${p.key}/${cz}/d${d}/${meal}: món chính ${base} g`);
            const add = x.items.reduce((s, [, g])=> s + g, 0) - base;
            if(add > 400) bad.push(`${p.key}/${cz}/d${d}/${meal}: +${add} g món phụ`);
          }
          if(cz === "all" && Math.abs(kcal - r.goalKcal) > r.goalKcal*0.10) bad.push(`${p.key}/d${d}: ${Math.round(kcal)}/${r.goalKcal} kcal`);
        }
      }
      expectNone([...new Set(bad)], "Thực đơn dự phòng sai");
    });
    t.test("BUG-06 (nutrition-pro): món chính ≤ 600 g ở cả chế độ Thuần chay", ()=>{
      const bad = [];
      for(const p of PROFILES){
        const r = app.run(`(()=>{ state.profile = Object.assign(defaultState().profile, ${JSON.stringify(p)}, { autoTargets:true }); recomputeProfile(); return JSON.parse(JSON.stringify(state.profile)); })()`);
        for(let d = 0; d < 7; d++){
          const plan = app.evj(`buildDayPlan(${JSON.stringify(r)}, ${d}, { vegan:true })`);
          for(const [meal, x] of Object.entries(plan)){ const g = (x.baseItems || []).reduce((s, [, q])=> s + q, 0); if(g > 600) bad.push(`${p.key}/d${d}/${meal}: ${x.id} ${g} g`); }
        }
      }
      expectNone(bad, "Món chính > 600 g (thuần chay)");
    });
    t.test("BUG-12: thanh đòn (kể cả 'Thanh đòn / Tạ đơn') — hiệp đầu 'Thanh rỗng 20 kg', không có mức < 20 kg, không trùng mức tạ", ()=>{
      const bad = [];
      for(const id of ["benchpress","rdl","squat"]) for(const kg of [22.5, 25, 30, 40, 45, 60, 100]){
        const h = app.call("warmupHTML", kg, app.evj(`EXERCISES.${id}`));
        const w = [...h.matchAll(/<b>([\d.]+) kg ×/g)].map(m=> Number(m[1]));
        if(w[0] !== 20 || !/Thanh rỗng/.test(h)) bad.push(`${id} ${kg} kg: hiệp đầu ${w[0]}`);
        if(w.some(x=> x < 20)) bad.push(`${id} ${kg} kg: có mức < 20`);
        if(new Set(w).size !== w.length) bad.push(`${id} ${kg} kg: trùng mức ${w.join(",")}`);
        if(w.some(x=> x >= kg)) bad.push(`${id} ${kg} kg: khởi động ≥ tạ chính`);
      }
      expectNone(bad, "Khởi động thanh đòn sai");
    });
    t.test("BUG-07/10: video theo meta — Kéo xà không lấy 'Pull Ups on Machine', bài tuỳ chỉnh (tên lạ) không lỗi", async ()=>{
      const names = JSON.parse(JSON.stringify(await app.ev(`findFreeExerciseVideos(EXERCISES.pullup.name)`))).map(v=> v.name);
      assert.ok(!names.includes("Pull Ups on Machine"), names.join(", "));
      assert.ok(names.includes("Pull-ups"), names.join(", "));
      const custom = JSON.parse(JSON.stringify(await app.ev(`findFreeExerciseVideos({ name:"Bài tự đặt <x>", equipment:"" })`)));
      assert.ok(Array.isArray(custom));
    });
    t.test("BUG-03: firestore.rules — users chỉ get (mình hoặc PT), list cấm; ghi chú ràng tác giả + kind; học viên chỉ sửa health/measurements/photos", ()=>{
      const r = read("firestore.rules");
      assert.match(r, /allow get: if signedIn\(\) && \(me\(\) == uid \|\| resource\.data\.isPT == true\);/);
      assert.match(r, /match \/users\/\{uid\}[\s\S]*?allow list: if false;/);
      assert.match(r, /d\.kind in \['note', 'reminder', 'feedback'\]/);
      assert.match(r, /allow update: if signedIn\(\) && sub == 'notes'[\s\S]*?resource\.data\.authorUid == me\(\)/);
      // vòng 2 (PT Connect): học viên còn ghi được chat (đã đọc) + trainingSync — KHÔNG được thêm trường gói/thanh toán/chủ sở hữu
      const stu = (r.match(/onlyKeys\(\['health', 'measurements', 'photos'[^\]]*\]\)/) || [""])[0];
      assert.equal(stu, "onlyKeys(['health', 'measurements', 'photos', 'chat', 'trainingSync', 'updatedAt'])");
      assert.ok(!/allow read, create, update: if signedIn\(\) && \(sub == 'sessions' \|\| sub == 'notes'\)/.test(r), "rule cũ cho ghi chú tự do vẫn còn");
    });
    t.test("BUG-03: cloud.js (Firebase) không ghi email vào users/{uid}; xoá tài khoản Apple gọi revokeAppleToken trước khi xoá user", ()=>{
      const src = read("cloud.js");
      const fbPart = src.slice(src.indexOf("const firebaseEngine"), src.indexOf("API CÔNG KHAI"));
      const writes = [...fbPart.matchAll(/collection\("users"\)\.doc\([^)]*\)\.set\(([^;]*)/g)].map(m=> m[1]).filter(x=> /\bemail\s*:/.test(x));
      expectNone(writes, "Ghi email vào hồ sơ công khai");
      assert.match(fbPart, /profile = \{ uid:user\.uid, name:user\.name/);
      const del = fbPart.slice(fbPart.indexOf("async deleteAccount"));
      assert.ok(del.indexOf("revokeAppleIfNeeded()") > 0 && del.indexOf("revokeAppleIfNeeded()") < del.indexOf("u.delete()"), "phải thu hồi token Apple TRƯỚC u.delete()");
      assert.match(src, /httpsCallable\("revokeAppleToken"\)/);
    });
    t.test("BUG-08: học viên đã kết nối nhập lại mã của chính form → không lỗi, không đổi studentUid", async ()=>{
      const a = await t.app();
      await a.ev(`cloud.signUp("pt.a@x.vn", "123456", "PT A")`); await a.ev(`cloud.updateMyProfile({ mainRole:"pt", isPT:true })`);
      const c = await a.ev(`cloud.createClient({ name:"HV" })`); const code = c.joinCode;
      await a.ev("cloud.signOut()"); await a.ev(`cloud.signUp("hv.a@x.vn", "123456", "HV A")`);
      const j1 = JSON.parse(JSON.stringify(await a.ev(`cloud.joinByCode(${JSON.stringify(code)})`)));
      const j2 = JSON.parse(JSON.stringify(await a.ev(`cloud.joinByCode(${JSON.stringify(code)})`)));
      assert.equal(j1.studentUid, j2.studentUid);
      await a.ev("cloud.signOut()"); await a.ev(`cloud.signUp("hv.b@x.vn", "123456", "HV B")`);
      let msg = ""; try{ await a.ev(`cloud.joinByCode(${JSON.stringify(code)})`); }catch(e){ msg = e.message; }
      assert.match(msg, /đã có học viên dùng/);
    });

    /* ---------- 3. Thương hiệu TapEasy ---------- */
    t.test("Thương hiệu: màn chào + đăng nhập + splash dùng logo assets/brand/… (alt=\"TapEasy\"), không còn FIT KIT", async ()=>{
      const a = await t.app({ state:false }); await a.settle(30);
      const wl = a.lastHtml("auth-body");
      assert.match(wl, /src="assets\/brand\/logo-wordmark-light\.svg" alt="TapEasy"/);
      assert.match(wl, /assets\/brand\/logo-mark\.svg/);
      assert.match(wl, /© 2026 TapEasy/);
      a.run(`showAuth("login")`); const lg = a.lastHtml("auth-body");
      assert.match(lg, /class="auth-logo" src="assets\/brand\/logo-wordmark-light\.svg" alt="TapEasy"/);
      const all = a.dom.htmlLog.map(x=> x.html).join("\n");
      assert.ok(!OLD_BRAND.test(all), "còn FIT KIT: " + (all.match(/.{0,60}FIT ?KIT.{0,60}/) || [""])[0]);
      const html = read("index.html");
      for(const f of ["logo-wordmark-light.svg","logo-wordmark-dark.svg"]) assert.ok(html.includes(`assets/brand/${f}`), "index.html thiếu " + f);
      // vòng 2: splash nền tối dùng lockup bản sáng (logo-full.png chữ than chỉ cho nền sáng — BRAND.md §7.5)
      assert.match(read("pt.js"), /class="splash-logo on-dark" src="assets\/brand\/logo-lockup-light\.svg" alt="TapEasy"/);
      assert.ok(!/logo-full\.png/.test(read("pt.js")), "pt.js còn dùng logo-full.png (chữ than) trên nền tối");
      assert.match(html, /<link rel="stylesheet" href="brand\.css">/);
    });
    t.test("Thương hiệu: không còn chữ 'FIT KIT' hiển thị trong mọi HTML đã render (màn chính + menu + sheet) và trong mã JS (trừ khoá dữ liệu cũ)", async ()=>{
      const all = app.dom.htmlLog.map(x=> x.html).join("\n");
      assert.ok(!OLD_BRAND.test(all), "HTML đã render còn: " + (all.match(/.{0,60}FIT ?KIT.{0,60}/) || [""])[0]);
      const bad = [];
      for(const f of scriptOrder()) read(f).split("\n").forEach((l, i)=>{
        if(OLD_BRAND.test(l) && !/provider|khoá provider cũ|khoá dữ liệu cũ/.test(l)) bad.push(`${f}:${i+1} ${l.trim().slice(0, 90)}`);
      });
      expectNone(bad, "Chuỗi FIT KIT trong mã");
      const tp = read("training-pro.js");
      assert.ok(!/spaced\(c, "FIT"|fillText\("FIT KIT"|title:"FIT KIT"/.test(tp), "thẻ chia sẻ canvas còn FIT KIT");
      assert.match(tp, /spaced\(c, "Tap"[\s\S]*?"Easy"/);
    });
    t.test("Thương hiệu: KHÔNG đổi khoá kỹ thuật (localStorage fitkit_state_v1, demo cloud, IndexedDB, file sao lưu Drive)", ()=>{
      assert.equal(app.ev("STORAGE_KEY"), "fitkit_state_v1");
      assert.match(read("cloud.js"), /const DEMO_KEY = "fitkit_cloud_demo_v1"/);
      assert.match(read("app.js"), /DB_NAME = "fitkit-db"/);
      assert.match(read("app.js"), /DRIVE_BACKUP_NAME = "fitkit-backup\.zip"/);
      assert.ok(app.localStorage.getItem("fitkit_state_v1"), "state không lưu vào khoá cũ");
    });
    t.test("Khu PT gọi là 'TapEasy PT' (tiêu đề màn, menu, lời mời)", ()=>{
      assert.match(read("index.html"), /<div class="logo">TapEasy PT<\/div>/);
      assert.match(read("coach.js"), /trên TapEasy PT\. Tải app TapEasy/);
      // fix-core vòng 2 (QU-18, GLOSSARY §8.1 "PT"): menu ☰ không dùng "TapEasy PT — PT & Học viên" nữa — mục PT (lối tắt, thanh dưới đã có) = "PT · Học viên · PT của tôi"
      assert.match(read("app.js"), /"groups", "PT", "Học viên · PT của tôi"/);
    });

    /* ---------- 4. Đóng gói ---------- */
    t.test("sw.js: cache đủ mọi JS/CSS cục bộ của index.html + logo; đổi tên cache; lưu từng file (1 file 404 không làm hỏng cả cache)", ()=>{
      const sw = read("sw.js"), html = read("index.html");
      assert.ok(!/fitkit-v3/.test(sw), "chưa tăng tên cache");
      const local = [...html.matchAll(/(?:src|href)="([^"#:]+\.(?:js|css))"/g)].map(m=> m[1]);
      expectNone(local.filter(f=> !sw.includes(`"./${f}"`)), "sw.js thiếu");
      assert.match(sw, /ASSETS\.map\(u=>[\s\S]{0,200}c\.put\(u, res\)[\s\S]{0,40}\.catch/);   // R3: lưu từng file bằng fetch(cache:reload)+put
      for(const f of ["logo-mark.svg","logo-wordmark-light.svg","logo-wordmark-dark.svg","logo-full.png"]) assert.ok(sw.includes(`./assets/brand/${f}`), "sw.js thiếu " + f);
    });
    t.test("prepare-www.sh: chép đủ mọi JS/CSS mà index.html nạp + assets/brand", ()=>{
      const sh = read("scripts/prepare-www.sh"), html = read("index.html");
      const words = new Set(sh.split(/\s+/));
      const local = [...html.matchAll(/(?:src|href)="([^"#:]+\.(?:js|css))"/g)].map(m=> m[1]);
      expectNone(local.filter(f=> !words.has(f) && !(/^i18n[\w.-]*\.js$/.test(f) && /for f in i18n\*\.js/.test(sh))), "prepare-www.sh thiếu");   // R3: i18n*.js chép bằng glob
      assert.match(sh, /assets\/brand/);
    });
    t.test("themes-modules.css đã sinh lại gồm CSS của cả 6 module", ()=>{
      const css = read("themes-modules.css");
      for(const f of ["achievements.css","health-safety.css","nutrition-pro.css","program-builder.css","pt-pro.css","training-pro.css"]) assert.ok(css.includes(`===== ${f}`), "thiếu lớp màu " + f);
    });
  },
};

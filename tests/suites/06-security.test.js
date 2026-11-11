/* Bảo mật cơ bản: XSS (quét tĩnh + tái hiện động trên DOM shim), link ngoài, Firestore rules */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert, expectNone } = require("../lib/framework");
const { scanApp, scanCloudFields } = require("../lib/xss-scan");
const { scriptOrder, APP_DIR } = require("../lib/harness");

const EVIL = `<img src=x onerror=alert(1)>`;
const hasRawTag = html => /<img src=x onerror=alert/i.test(html) || /<svg onload=/i.test(html);

module.exports = {
  name: "Bảo mật cơ bản: XSS, link ngoài, Firestore rules",
  area: "Bảo mật (toàn bộ file JS + firestore.rules)",
  async define(t){
    const app = await t.app();
    const files = scriptOrder();
    const found = scanApp(APP_DIR, files);
    const cloudFields = scanCloudFields(APP_DIR, ["coach.js","ptprofile.js","pt.js"]);
    const fmt = x => `${x.file}:${x.line}  \${${x.expr}}  (${x.where})`;

    t.test("escapeHtml: thoát & < > \" ' và ép kiểu chuỗi", ()=>{
      assert.equal(app.call("escapeHtml", `<a href="x" title='y'>&</a>`), "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
      assert.equal(app.call("escapeHtml", 42), "42");
      assert.equal(app.call("escapeHtml", "Ức gà 100%"), "Ức gà 100%");
    });

    /* ---------- BUG-01: toast() chèn HTML thô — dữ liệu người khác lọt vào ---------- */
    t.test("toast(): nội dung phải được escape (toast đang gán innerHTML thô)", ()=>{
      app.call("toast", EVIL);
      assert.ok(!hasRawTag(app.lastHtml("toast")), "#toast = " + app.lastHtml("toast"));
    }, { bug:"BUG-01", severity:"Cao" });
    t.test("Nhắc buổi PT (checkCoachReminders): tên PT / tiêu đề buổi do người khác đặt KHÔNG được chạy như HTML", ()=>{
      app.setNow("2026-11-20T09:00");
      app.run(`state.coachPrefs.remind = true; state._firedKeys = {}; state.coachUpcoming = [{ cid:"c1", sid:"s1", role:"student", date:"2026-11-20", time:"10:00",
        title:${JSON.stringify(EVIL)}, who:${JSON.stringify("<svg onload=alert('PT')>")}, mode:"offline", before:60 }];`);
      app.call("checkCoachReminders");
      app.setNow(null);
      const html = app.lastHtml("toast");
      assert.ok(html.includes("10:00"), "toast nhắc buổi không hiện: " + html);
      assert.ok(!hasRawTag(html), "pt.js checkCoachReminders → toast(body) chứa HTML thô: " + html);
    }, { bug:"BUG-01", severity:"Cao" });
    t.test("Học viên nhập mã PT: toast 'Đã kết nối với PT …' không chạy HTML trong tên PT", async ()=>{
      const a = await t.app();
      await a.ev(`cloud.signUp("pt.xau@x.vn", "123456", ${JSON.stringify("<svg onload=alert('pt')>")})`);
      await a.ev(`cloud.updateMyProfile({ mainRole:"pt", isPT:true })`);
      const code = (await a.ev(`cloud.createClient({ name:"HV" })`)).joinCode;
      await a.ev("cloud.signOut()");
      await a.ev(`cloud.signUp("hv@x.vn", "123456", "Học viên")`);
      a.run("openJoinSheet()");
      a.dom.registry.get("jn-code").value = code;
      a.dom.registry.get("jn-go").click();
      // vòng 2: pt-connect.js thay sheet nhập mã → xem trước PT → "Chấp nhận" (#pv-yes)
      if(a.ev("typeof TEConnect") !== "undefined"){
        const pvYes = ()=> a.dom.registry.get("pv-yes");
        for(let i = 0; i < 60 && !(pvYes() && (pvYes()._listeners.click || []).length); i++) await a.settle(25);
        assert.ok(pvYes(), "chưa hiện xem trước PT: " + (a.dom.registry.get("jn-err") || {}).textContent);
        assert.ok(!hasRawTag(a.lastHtml("jn-preview")), "xem trước PT chứa HTML thô: " + a.lastHtml("jn-preview"));
        pvYes().click();
      }
      for(let i = 0; i < 60 && !/kết nối/.test(a.lastHtml("toast")); i++) await a.settle(25);
      const html = a.lastHtml("toast");
      assert.ok(/kết nối/.test(html), "chưa thấy toast kết nối: " + html + " | err: " + (a.dom.registry.get("jn-err") || {}).textContent);
      assert.ok(!hasRawTag(html), "coach.js:311 toast chứa HTML thô: " + html);
    }, { bug:"BUG-01", severity:"Cao" });

    /* ---------- BUG-02: trường dữ liệu cloud chèn thô vào HTML / thuộc tính / href ---------- */
    t.test("Chi tiết bài PT giao (openSessionExerciseDetail): số hiệp/nghỉ do PT ghi phải được escape", ()=>{
      app.run(`openSessionExerciseDetail({ name:"Squat", sets:${JSON.stringify(EVIL)}, reps:"8", restSec:${JSON.stringify("<svg onload=alert(2)>")} })`);
      const html = app.lastHtml("sheet-content");
      assert.ok(!hasRawTag(html), "coach.js:542/544 chèn e.sets / e.restSec thô");
    }, { bug:"BUG-02", severity:"Trung bình" });
    t.test("Ghi chú PT ↔ học viên (cfNotesTab): trường kind không được phá thuộc tính class", ()=>{
      app.run(`ptData.notes["cX"] = [{ id:"n1", authorUid:"other", authorRole:"student", authorName:"HV", text:"chào", ts:Date.now(), kind:'x" onmouseover="alert(1)' }];
        cf = { cid:"cX", role:"pt", tab:"notes", focusSid:null }; globalThis.__body = document.createElement("div"); cfNotesTab(__body, { id:"cX" });`);
      const html = app.ev("__body.innerHTML");
      assert.ok(!/k-x" onmouseover="alert\(1\)/.test(html), "coach.js:819 → class=\"bubble  k-x\" onmouseover=\"alert(1)\"");
    }, { bug:"BUG-02", severity:"Trung bình" });
    t.test("Hồ sơ PT (renderPTProfile): ảnh PT không được phá thuộc tính src", ()=>{
      app.run(`ppCtx = { ptId:"p1", cid:null, profile:null }; renderPTProfile({ uid:"p1", name:"PT An", photo:'x" onerror="alert(1)', stats:{} });`);
      const html = app.lastHtml("pp-content");
      assert.ok(html.length > 100, "renderPTProfile chưa render");
      assert.ok(!/src="x" onerror="alert\(1\)"/.test(html), "ptprofile.js:75 <img src=\"${pr.photo}\"> chèn thô");
    }, { bug:"BUG-02", severity:"Trung bình" });
    t.test("Credit video (stockCreditHTML): link chỉ nhận http(s), chặn javascript:", ()=>{
      const html = app.call("stockCreditHTML", { provider:"Pexels", pageUrl:"javascript:alert(document.cookie)", url:"https://x/y.mp4" });
      assert.ok(!/href="javascript:/i.test(html), "video.js stockCreditHTML: " + html.slice(0, 120));
    }, { bug:"BUG-02", severity:"Trung bình" });
    t.test("Quét tĩnh: không còn trường dữ liệu cloud (của tài khoản khác) chèn thô vào HTML", ()=>{
      expectNone(cloudFields.map(fmt), "Chèn thô dữ liệu cloud", 30);
    }, { bug:"BUG-02", severity:"Trung bình" });

    /* ---------- BUG-18: dữ liệu tự nhập chèn thô (self-XSS / phòng thủ nhiều lớp) ---------- */
    t.test("Màn Buổi tập: tên bài tuỳ chỉnh / tên chương trình phải được escape", ()=>{
      app.run(`state.plans.__x = { id:"__x", name:${JSON.stringify(EVIL)}, days:{} }; ["T2","T3","T4","T5","T6","T7","CN"].forEach(k=> state.plans.__x.days[k] = { title:${JSON.stringify("<svg onload=alert(3)>")}, intensity:"Vừa", duration:30,
        items:[{ uid:"cx"+k, exerciseId:null, custom:{ name:${JSON.stringify(EVIL)} }, sets:3, reps:"10", restSec:60 }] }); state.activePlanId = "__x"; state.selectedDay = todayDayKey(); renderWorkoutScreen();`);
      const html = app.lastHtml("exercise-list") + app.lastHtml("today-card");
      assert.ok(!hasRawTag(html), "app.js:512/540 chèn day.title / meta.name thô");
    }, { bug:"BUG-18", severity:"Thấp" });
    t.test("Quét tĩnh: dữ liệu tự nhập (plan, bài tuỳ chỉnh, món, ghi chú, tên hồ sơ) chèn thô", ()=>{
      expectNone(found.filter(x=> x.cls === "self").map(fmt), "Chèn thô dữ liệu tự nhập", 30);
    }, { bug:"BUG-18", severity:"Thấp" });
    t.test("Quét tĩnh: không có mẫu chèn thô CHƯA phân loại (review)", ()=>{
      expectNone(found.filter(x=> x.cls === "review" && !/^[\w./*+\-() ]+$/.test(x.expr) ).map(fmt), "Cần người xem");
    });

    /* ---------- Các kiểm tra đang đạt (giữ để chống hồi quy) ---------- */
    t.test("Nhận xét AI (renderAiResultSheet) được escape — chống prompt-injection thành XSS", ()=>{
      app.run(`renderAiResultSheet({ angle:"front", weightAtCapture:70 }, ${JSON.stringify(EVIL)})`);
      assert.ok(!hasRawTag(app.lastHtml("sheet-content")));
    });
    t.test("Trang chủ: tên PT/học viên và tiêu đề buổi PT được escape", ()=>{
      app.run(`state.coachPrefs.remind = true; state.coachUpcoming = [{ cid:"c1", sid:"s1", role:"student", date:todayStr(new Date(Date.now()+86400000)), time:"10:00", title:${JSON.stringify(EVIL)}, who:${JSON.stringify(EVIL)}, mode:"online", before:60 }]; renderHomeScreen();`);
      assert.ok(!hasRawTag(app.lastHtml("home-content")));
    });
    t.test("openExternal: chặn link không phải http(s) (javascript:, data:)", ()=>{
      app.run("globalThis.__opened = []; window.open = (u)=>{ __opened.push(u); return null; };");
      app.call("openExternal", "javascript:alert(1)"); app.call("openExternal", "data:text/html,<script>alert(1)</script>");
      app.call("openExternal", "https://youtu.be/abc");
      assert.deepEqual(app.evj("__opened"), ["https://youtu.be/abc"]);
    });
    t.test("Không dùng eval / new Function / document.write; mọi target=_blank có rel=noopener", ()=>{
      const bad = [];
      for(const f of files){
        const src = fs.readFileSync(path.join(APP_DIR, f), "utf8");
        src.split("\n").forEach((l, i)=>{
          // Ngoại lệ duy nhất (vòng 2): events.js in poster check-in — ghi vào cửa sổ in mới (about:blank) bản tuần tự hoá
          // innerHTML của phần tử đã escape trong app (${p.innerHTML}), không nội suy dữ liệu mới.
          const printPopup = /\bw\.document\.write\(`[^`]*\$\{p\.innerHTML\}`\)/.test(l) && f === "events.js";
          if(/\beval\(|new Function\(|document\.write\(/.test(l) && !printPopup) bad.push(`${f}:${i+1} ${l.trim().slice(0, 80)}`);
          for(const m of l.matchAll(/target="_blank"[^>]*/g)) if(!/noopener/.test(m[0])) bad.push(`${f}:${i+1} target=_blank thiếu rel=noopener`);
        });
      }
      expectNone(bad, "Mẫu nguy hiểm");
    });
    t.test("Firestore rules: không cho liệt kê toàn bộ users (lộ email); ghi chú/buổi tập phải ràng buộc tác giả = người ghi", ()=>{
      const rules = fs.readFileSync(path.join(APP_DIR, "firestore.rules"), "utf8");
      const usersBlock = (rules.match(/match \/users\/\{uid\}\s*\{([\s\S]*?)\n\s*\}/) || [])[1] || "";
      const subBlock = (rules.match(/match \/\{sub\}\/\{docId\}\s*\{([\s\S]*?)\n\s*\}/) || [])[1] || "";
      const bad = [];
      if(/allow read:\s*if signedIn\(\);/.test(usersBlock) && !/allow list:\s*if false/.test(usersBlock))
        bad.push("users/{uid}: `allow read: if signedIn()` gồm cả LIST → mọi tài khoản tải được email + hồ sơ của toàn bộ người dùng");
      if(!/authorUid\s*==\s*(me\(\)|request\.auth\.uid)/.test(subBlock))
        bad.push("clients/{cid}/{sub}: create/update không kiểm request.resource.data.authorUid == me() → học viên giả mạo ghi chú 'PT', sửa ghi chú của người kia");
      expectNone(bad, "Firestore rules");
    }, { bug:"BUG-03", severity:"Cao" });

    t.info("Quét tĩnh — chèn thô theo phân loại", ["cross-user","sink","self","external","review","static"].flatMap(c=>{
      const xs = found.filter(x=> x.cls === c); return xs.length ? [`[${c}] ${xs.length} chỗ`].concat(xs.map(x=> "   " + fmt(x))) : [];
    }));
    t.info("Quét tĩnh — trường dữ liệu cloud chèn thô (coach.js / ptprofile.js / pt.js)", cloudFields.map(fmt));
  },
};

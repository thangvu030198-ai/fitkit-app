/* =========================================================================
   Vòng R3 (14/11/2026) — agent CORE (app.js, training-pro.js …)
   Hồi quy cho các lỗi R3-CORE-nn (xem docs/qa/R3-core.md). Mỗi test mang mã lỗi trong tên.
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");

const PROF = o=> Object.assign({ name:"Tester", gender:"male", age:30, height:172, weight:72, activity:"moderate", goal:"gain", autoTargets:true }, o || {});
const WED = "2026-11-11T09:00";            // thứ Tư (T4)
const XSS = `"><img src=x onerror=alert(1)>`;
const DANGER = /<img src=x onerror=alert|" onerror="alert|<svg onload=alert|javascript:alert/i;
const lastClick = id=> `document.getElementById("${id}")._listeners.click.slice(-1)[0]()`;

/* giáo án 1 ngày T4, 1 bài tạ đòn — tham số sets / restSec để thử giá trị xấu */
const PLAN = (sets, rest)=> `(()=>{ const p = createBlankPlan("R3"); p.days.T4.title = "Buổi T4";
  p.days.T4.items = [{ uid:"a1", exerciseId:"benchpress", sets:${JSON.stringify(sets)}, reps:"8-12", restSec:${JSON.stringify(rest)}, clipId:null },
                     { uid:"a2", exerciseId:"pushup", sets:3, reps:"10-12", restSec:60, clipId:null }];
  state.activePlanId = p.id; saveState(); return p.id; })()`;

module.exports = {
  name: "Vòng R3 — Lõi app.js (r3-core)",
  area: "app.js / training-pro.js",
  async define(t){

    /* ======================= STATE / LƯU TRỮ ======================= */
    t.test("R3-CORE-01: JSON trong localStorage bị hỏng → app vẫn mở, GIỮ bản gốc ở key phụ (không ghi đè mất), saveState sau đó vẫn chạy", async ()=>{
      const raw = `{"onboarded":true,"profile":{"name":"An","weight":70`;      // JSON cụt
      const app = await t.app({ storage:{ fitkit_state_v1: raw } });
      assert.equal(app.loadErrors.length, 0, "app phải nạp được: " + app.loadErrors.map(e=> e.file + " " + e.error).join("; "));
      assert.equal(app.ev("loadState.corrupt"), true);
      const kept = JSON.parse(app.localStorage.getItem("fitkit_state_v1_corrupt"));
      assert.equal(kept.raw, raw, "bản hỏng phải được giữ nguyên văn");
      assert.equal(app.ev("saveState()"), true);
      assert.doesNotThrow(()=> JSON.parse(app.localStorage.getItem("fitkit_state_v1")));
      assert.equal(JSON.parse(app.localStorage.getItem("fitkit_state_v1_corrupt")).raw, raw, "lần lưu sau không xoá bản đã giữ");
    });
    t.test("R3-CORE-01: state là mảng / null / số → coi là hỏng, không vỡ; dữ liệu hợp lệ thì không tạo key phụ", async ()=>{
      for(const raw of ["[1,2]", "null", "42", `"x"`]){
        const app = await t.app({ storage:{ fitkit_state_v1: raw } });
        assert.equal(app.loadErrors.length, 0, raw);
        assert.equal(typeof app.ev("state.profile"), "object", raw);
      }
      const ok = await t.app({ state:{ profile: PROF() } });
      assert.equal(ok.localStorage.getItem("fitkit_state_v1_corrupt"), null);
      assert.ok(!ok.ev("loadState.corrupt"));
    });
    t.test("R3-CORE-09: localStorage bị CHẶN (SecurityError) → saveState trả false + báo 'chặn lưu dữ liệu' (không báo nhầm 'đầy'); đọc bị chặn → app vẫn mở", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      const r = app.run(`(()=>{ const o = localStorage.setItem; localStorage.setItem = ()=>{ const e = new Error("denied"); e.name = "SecurityError"; throw e; };
        saveState._warnAt = 0; let v; try{ v = saveState(); } finally { localStorage.setItem = o; } return v; })()`);
      assert.equal(r, false);
      assert.match(app.lastHtml("toast"), /chặn lưu dữ liệu/);
      assert.equal(app.ev("saveState.lastError"), "SecurityError");
      assert.equal(app.ev("saveState()"), true);
      assert.equal(app.ev("saveState.lastError"), null);
      // getItem ném lỗi lúc nạp
      const st = app.run(`(()=>{ const o = localStorage.getItem; localStorage.getItem = ()=>{ const e = new Error("denied"); e.name = "SecurityError"; throw e; };
        let s; try{ s = loadState(); } finally { localStorage.getItem = o; } return JSON.stringify({ ok: !!s && s.onboarded === false, blocked: loadState.blocked }); })()`);
      assert.deepEqual(JSON.parse(st), { ok:true, blocked:true });
    });
    t.test("R3-CORE-09: đầy bộ nhớ → dọn _firedKeys cũ + bản hỏng đã giữ rồi THỬ LẠI 1 lần; _firedKeys chỉ giữ khoá hôm nay", async ()=>{
      const app = await t.app({ state:{ profile: PROF(), _firedKeys: { "2026-01-01_07:00_meal_breakfast": true, "2025-12-31_22:30_bedtime": true } } });
      assert.deepEqual(app.evj("Object.keys(state._firedKeys)"), [], "khoá ngày cũ phải bị dọn khi nạp");
      app.setNow(WED);
      app.run(`state._firedKeys = { "2026-11-10_07:00_x": true, "2026-11-11_07:00_y": true }; localStorage.setItem("fitkit_state_v1_corrupt", "x");`);
      const r = app.run(`(()=>{ const o = localStorage.setItem; let n = 0; localStorage.setItem = function(k, v){ if(++n === 1){ const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; } return o.call(localStorage, k, v); };
        let v; try{ v = saveState(); } finally { localStorage.setItem = o; } return v; })()`);
      assert.equal(r, true, "lần thử lại sau khi dọn phải lưu được");
      assert.deepEqual(app.evj("Object.keys(state._firedKeys)"), ["2026-11-11_07:00_y"]);
      assert.equal(app.localStorage.getItem("fitkit_state_v1_corrupt"), null);
    });
    t.test("R3-CORE-13: tab khác vừa lưu (sự kiện storage) → nạp lại state mới; đang trong buổi tập thì chờ, xong buổi mới nạp", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.setNow(WED);
      const fire = ()=> app.run(`(globalThis.__winListeners.storage || []).forEach(fn=> fn({ key:"fitkit_state_v1", newValue:"x" }))`);
      const other = JSON.parse(app.localStorage.getItem("fitkit_state_v1"));
      other.waterLog = { "2026-11-11": 1.25 }; other.profile.weight = 75;
      app.localStorage.setItem("fitkit_state_v1", JSON.stringify(other));
      fire();
      assert.equal(app.ev("state.waterLog['2026-11-11']"), 1.25);
      assert.equal(app.ev("state.profile.weight"), 75);
      // đang tập → không nạp đè
      app.run(PLAN(3, 60)); app.run(`startSession("T4")`);
      const o2 = JSON.parse(app.localStorage.getItem("fitkit_state_v1")); o2.waterLog["2026-11-11"] = 2;
      app.run(`state.waterLog["2026-11-11"] = 1.5`);
      app.localStorage.setItem("fitkit_state_v1", JSON.stringify(o2));
      fire();
      assert.equal(app.ev("state.waterLog['2026-11-11']"), 1.5, "đang trong buổi tập không được thay state");
      // khoá sai / giá trị rác không làm vỡ
      app.run(`(globalThis.__winListeners.storage || []).forEach(fn=> fn({ key:"khac", newValue:"{}" }))`);
      app.run(`(globalThis.__winListeners.storage || []).forEach(fn=> fn(null))`);
    });

    /* ======================= TÍNH TOÁN ======================= */
    t.test("R3-CORE-04: hồ sơ sai kiểu / NaN / âm / cực lớn (dữ liệu cũ, sao lưu) → BMR/TDEE/calo/macro luôn là số hữu hạn ≥ 0", async ()=>{
      const bad = [
        { weight:"abc", height:-5, age:NaN },
        { weight:null, height:null, age:null },
        { weight:1e9, height:1e9, age:1e9 },
        { weight:-70, height:0, age:-3, gender:"x" },
        { weight:"70", height:"172", age:"30" },
        { weight:"70,5", height:"172", age:"30" },
      ];
      for(const b of bad){
        const app = await t.app({ state:{ profile: PROF(b) } });
        app.call("recomputeProfile");
        const p = app.evj("state.profile");
        for(const k of ["bmr","tdee","goalKcal","protein","carbs","fat","weight","height","age"]){
          assert.ok(typeof p[k] === "number" && Number.isFinite(p[k]) && p[k] >= 0, `${k} = ${p[k]} với ${JSON.stringify(b)}`);
        }
        assert.ok(p.bmr > 600 && p.bmr < 6000, `BMR phi lý ${p.bmr} với ${JSON.stringify(b)}`);
        assert.ok(p.goalKcal >= 1200 && p.goalKcal < 12000, `calo phi lý ${p.goalKcal}`);
      }
      const app = await t.app({ state:{ profile: PROF({ weight:"70", height:"172", age:"30" }) } });
      assert.equal(app.ev("state.profile.weight"), 70);
      assert.equal(app.ev(`calcBMR({ gender:"male", weight:"70", height:"172", age:"30" })`), 1630);   // 700 + 1075 − 150 + 5
      assert.equal(app.ev(`calcBMR({ gender:"male", weight:70, height:172, age:30 })`), 1630);
      assert.ok(Number.isFinite(app.ev("calcBMR({})")) && Number.isFinite(app.ev("calcBMR(null)")));
      assert.ok(Number.isFinite(app.ev(`calcTDEE(NaN, "khong-co")`)) && Number.isFinite(app.ev(`calcGoalKcal(undefined, "x")`)));
      const m = app.evj(`calcMacros("abc", NaN, {})`);
      assert.ok(["protein","carbs","fat"].every(k=> Number.isFinite(m[k]) && m[k] >= 0), JSON.stringify(m));
    });
    t.test("R3-CORE-04: hồ sơ hợp lệ KHÔNG bị đổi (số thập phân, tuổi vị thành niên, bodyfat null, mục tiêu tự chỉnh)", async ()=>{
      const app = await t.app({ state:{ profile: PROF({ weight:58.5, height:160.5, age:16, bodyfat:null, autoTargets:false, goalKcal:2100, protein:120, carbs:250, fat:60, sleepGoalHours:7.5, waterTargetOverride:2.5 }) } });
      app.call("recomputeProfile");
      const p = app.evj("state.profile");
      assert.equal(p.weight, 58.5); assert.equal(p.height, 160.5); assert.equal(p.age, 16); assert.equal(p.bodyfat, null);
      assert.equal(p.goalKcal, 2100); assert.equal(p.protein, 120); assert.equal(p.sleepGoalHours, 7.5); assert.equal(p.waterTargetOverride, 2.5);
    });

    /* ======================= ĐẦU VÀO GIÁO ÁN / BUỔI TẬP ======================= */
    t.test("R3-CORE-05: số hiệp / nghỉ / số lần / tên được kẹp (1–20 hiệp, 0–900 giây, ≤ 24 và ≤ 60 ký tự); '0 giây nghỉ' lưu được", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      const c = (fn, ...a)=> app.call(fn, ...a);
      assert.equal(c("fkClampSets", "100000"), 20); assert.equal(c("fkClampSets", -3, 4), 4); assert.equal(c("fkClampSets", "abc"), 3);
      assert.equal(c("fkClampSets", "2.6"), 3); assert.equal(c("fkClampSets", Infinity, 5), 5); assert.equal(c("fkClampSets", 1), 1);
      assert.equal(c("fkClampRest", "0"), 0); assert.equal(c("fkClampRest", "99999"), 900); assert.equal(c("fkClampRest", -5, 45), 45);
      assert.equal(c("fkClampRest", "", 90), 90); assert.equal(c("fkClampRest", "abc"), 60);
      assert.equal(c("fkCleanReps", "  8-12  "), "8-12"); assert.equal(c("fkCleanReps", ""), "12"); assert.equal(c("fkCleanReps", "x".repeat(99)).length, 24);
      assert.ok(!/[<>]/.test(c("fkCleanReps", "<b>10</b>")));
      assert.equal(c("fkCleanName", "  A \n  B  "), "A B"); assert.equal(c("fkCleanName", "", "Mặc định"), "Mặc định"); assert.equal(c("fkCleanName", "y".repeat(500)).length, 60);
      // tên giáo án cực dài / nhân bản nhiều lần không phình
      const id = app.run(`createBlankPlan("z".repeat(5000)).id`);
      assert.equal(app.ev(`state.plans["${id}"].name.length`), 60);
      const d = app.run(`duplicatePlan("${id}").name`);
      assert.ok(d.length <= 60 && /\(bản sao\)$/.test(d), d);
      assert.equal(app.ev(`duplicatePlan("khong-co")`), null, "nhân bản giáo án không tồn tại không được ném lỗi");
    });
    t.test("R3-CORE-05: bài có sets = 100000 (nhập từ PT/sao lưu) → màn buổi tập chỉ dựng ≤ 20 hàng, không treo", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.setNow(WED); app.run(PLAN(100000, 60));
      const t0 = Date.now();
      app.run(`startSession("T4")`);
      assert.ok(Date.now() - t0 < 3000, "dựng màn quá lâu");
      assert.equal(app.ev(`session.sets["a1"].length`), 20);
      for(const v of [-4, 0, "abc", null]){
        const a2 = await t.app({ state:{ profile: PROF() } });
        a2.setNow(WED); a2.run(PLAN(v, 60)); a2.run(`startSession("T4")`);
        assert.equal(a2.ev(`session.sets["a1"].length`), 1, "sets = " + JSON.stringify(v));
      }
    });
    t.test("R3-CORE-05: sửa bài trong giáo án — gõ số âm / cực lớn / 0 giây nghỉ được kẹp khi lưu", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.setNow(WED); const pid = app.run(PLAN(3, 60));
      const save = (sets, reps, rest)=> app.run(`(()=>{ const pl = state.plans["${pid}"]; openPlanItemEditor(pl, "T4", "a1");
        document.getElementById("pie-sets").value = ${JSON.stringify(sets)}; document.getElementById("pie-reps").value = ${JSON.stringify(reps)}; document.getElementById("pie-rest").value = ${JSON.stringify(rest)};
        ${lastClick("pie-save")}; const it = pl.days.T4.items[0]; return JSON.stringify([it.sets, it.reps, it.restSec]); })()`);
      assert.deepEqual(JSON.parse(save("999999", "8-12", "0")), [20, "8-12", 0]);
      assert.deepEqual(JSON.parse(save("-2", "", "-30")), [20, "8-12", 0], "giá trị xấu → giữ giá trị cũ");
      assert.deepEqual(JSON.parse(save("4", "x".repeat(200), "1e9")), [4, "x".repeat(24), 900]);
    });

    /* ======================= HẸN GIỜ NGHỈ ======================= */
    t.test("R3-CORE-06: đồng hồ nghỉ đếm theo mốc thời gian — khoá màn hình 45 giây rồi quay lại thấy còn 15 (không phải 59); '+15s' với restSec dạng chuỗi không thành '6015'", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.setNow(WED); app.run(PLAN(3, "60")); app.run(`startSession("T4")`);
      app.run(`startSetRest("60")`);
      assert.equal(String(app.dom.registry.get("rest-num").textContent), "60");
      assert.equal(app.dom.registry.get("set-rest").hidden, false);
      app.setNow("2026-11-11T09:00:45");
      app.call("fkRestSync");                                      // 1 nhịp sau khi trình duyệt bóp timer
      assert.equal(String(app.dom.registry.get("rest-num").textContent), "15");
      app.dom.registry.get("rest-plus").onclick();
      assert.equal(String(app.dom.registry.get("rest-num").textContent), "30");
      assert.equal(app.call("fkRestLeft"), 30);
      app.setNow("2026-11-11T09:01:20");                           // quá giờ
      assert.equal(app.call("fkRestSync"), false);
      assert.equal(app.dom.registry.get("set-rest").hidden, true);
      assert.equal(app.ev("window._restEnd"), 0);
      assert.match(app.lastHtml("toast"), /Hết giờ nghỉ/);
    });
    t.test("R3-CORE-06: số giây nghỉ xấu (âm, NaN, cực lớn) không tạo đồng hồ hỏng; bỏ qua / kết thúc buổi xoá mốc nghỉ", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.setNow(WED); app.run(PLAN(3, 60)); app.run(`startSession("T4")`);
      app.run(`window._restEnd = 0; startSetRest(-10); startSetRest("abc"); startSetRest(NaN);`);
      assert.equal(app.ev("window._restEnd"), 0);
      app.run(`startSetRest(1e9)`);
      assert.equal(app.call("fkRestLeft"), 900);
      app.call("stopSetRest");
      assert.equal(app.ev("window._restEnd"), 0);
      assert.equal(app.call("fkRestSync"), false);
    });

    /* ======================= BẢO MẬT: DỮ LIỆU LƯU / SAO LƯU CHÈN HTML ======================= */
    t.test("R3-CORE-07: state bị sửa tay / bản sao lưu độc (InBody, ảnh, video, giờ nhắc, nhà cung cấp AI, nhật ký ăn) không đưa được HTML vào màn hình", async ()=>{
      const app = await t.app({ state:{ profile: PROF({ name: XSS, avatarData: "javascript:alert(1)" }),
        inbodyLogs: [{ id: XSS, ts: 1, source: XSS, weight: XSS, bodyFatPct: XSS, muscleMassKg: XSS, note: "ghi <b>chú</b>" }, null, "x", { id:"ok1", ts: 2, source:"manual", weight:70.5, bodyFatPct:18 }],
        progressPhotos: [{ id: XSS, ts: 1 }, { id: 7, ts: XSS, angle: XSS, weightAtCapture: XSS }],
        videoLibrary: [{ id: XSS, name:"a" }, { id: 3, name: XSS, category: XSS, fit: XSS }],
        reminders: { master:true, workout:{ T4:{ enabled:true, time: XSS } }, meal:{ breakfast:{ enabled:true, time: XSS }, lunch: XSS }, bedtimeEnabled:true, bedtimeTime: XSS },
        aiSettings: { provider: XSS },
        foodLog: { "2026-11-11": { breakfast:[{ name: XSS, grams: XSS, kcal: XSS, protein: XSS, carbs: XSS, fat: XSS }, null], lunch:[], dinner:[], snack:[] } },
        sleepLog: { "2026-11-10": { hours: XSS }, "2026-11-09": { hours: 7.5, quality: 4 }, "2026-11-08": null },
        waterLog: { "2026-11-11": XSS },
        finishedDates: ["2026-11-10", "2026-11-10", XSS, "2026-11-09"],
      } });
      assert.equal(app.loadErrors.length, 0);
      app.setNow("2026-11-11T12:00");
      const st = app.evj("state");
      assert.equal(st.inbodyLogs.length, 2);
      assert.ok(/^[\w-]+$/.test(st.inbodyLogs[0].id) && st.inbodyLogs[0].weight === null && st.inbodyLogs[0].source === "manual");
      assert.equal(st.inbodyLogs[1].weight, 70.5);
      assert.deepEqual(st.progressPhotos.map(p=> p.id), [7]); assert.equal(st.progressPhotos[0].weightAtCapture, null);
      assert.deepEqual(st.videoLibrary.map(v=> v.id), [3]); assert.equal(st.videoLibrary[0].fit, "contain");
      assert.equal(st.reminders.workout.T4.time, "06:00"); assert.equal(st.reminders.bedtimeTime, "22:30");
      assert.equal(st.aiSettings.provider, "openai");
      assert.equal(st.profile.avatarData, null);
      assert.deepEqual(st.finishedDates, ["2026-11-09", "2026-11-10"]);
      assert.deepEqual(Object.keys(st.sleepLog), ["2026-11-09"]);
      assert.equal(st.waterLog["2026-11-11"], 0);
      assert.equal(st.foodLog["2026-11-11"].breakfast.length, 1); assert.equal(st.foodLog["2026-11-11"].breakfast[0].kcal, 0);
      // vẽ các màn dùng dữ liệu đó
      const n0 = app.dom.htmlLog.length;
      app.run(`progressUI.tab = "inbody"; goto("progress"); progressUI.tab = "photos"; renderProgressScreen(); goto("reminders"); goto("nutrition"); goto("sleep"); goto("library"); goto("workout"); goto("profile");
        openEditReminderTime("meal", "breakfast"); closeSheet(); openClipPicker(()=>{}); closeSheet(); renderAiFallback(state.progressPhotos[0], null); closeSheet();`);
      const html = app.dom.htmlLog.slice(n0).map(x=> x.html).join("\n");
      assert.ok(!DANGER.test(html), "còn HTML chạy được: " + (html.match(/.{0,80}onerror=alert.{0,40}/) || [""])[0]);
      assert.equal(app.call("providerLabel", XSS), "AI");
      assert.equal(app.call("fkNumTxt", XSS), "--"); assert.equal(app.call("fkNumTxt", 70.5), "70,5"); assert.equal(app.call("fkNumTxt", null), "--");
    });
    t.test("R3-CORE-07: biểu đồ InBody chỉ nhận số hữu hạn (không còn NaN/chuỗi trong toạ độ SVG); Gemini: model + key được mã hoá URL", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.run(`renderInbodyChart("#inbody-chart", [{ ts:1, weight:"<x>", bodyFatPct:NaN, source:"manual" }, { ts:2, weight:70, bodyFatPct:18, source:"ai" }, null, { ts:"a", weight:71, bodyFatPct:null }])`);
      const svg = app.lastHtml("inbody-chart");
      assert.ok(svg.includes("<svg") && !/NaN|<x>|undefined/.test(svg), svg.slice(0, 300));
      const src = read("app.js");
      assert.ok(src.includes("models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}"));
    });

    /* ======================= ẢNH ĐẠI DIỆN / BỘ NHỚ ======================= */
    t.test("R3-CORE-02: ảnh đại diện — không còn lưu nguyên tệp (FileReader → state); tệp không phải ảnh / > 25 MB bị từ chối; ảnh hỏng không đổi avatar", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      const src = read("app.js");
      assert.ok(!/state\.profile\.avatarData\s*=\s*reader\.result/.test(src), "vẫn gán reader.result (ảnh nguyên cỡ) vào state");
      assert.ok(/FK_AVATAR_PX\s*=\s*256/.test(src) && src.includes("toDataURL(\"image/jpeg\""));
      assert.equal(await app.run(`fkSetAvatar({ type:"application/pdf", size:10 })`), false);
      assert.match(app.lastHtml("toast"), /tệp ảnh/);
      assert.equal(await app.run(`fkSetAvatar({ type:"image/jpeg", size: 30*1024*1024 })`), false);
      assert.match(app.lastHtml("toast"), /25 MB/);
      // giải mã lỗi (fkShrinkImage từ chối) → giữ avatar cũ
      const r = await app.run(`(async ()=>{ state.profile.avatarData = "data:image/png;base64,AAAA"; fkShrinkImage = ()=> Promise.reject(new Error("decode"));
        const ok = await fkSetAvatar({ type:"image/png", size: 100 }); return JSON.stringify([ok, state.profile.avatarData]); })()`);
      assert.deepEqual(JSON.parse(r), [false, "data:image/png;base64,AAAA"]);
      // thu nhỏ xong nhưng lưu thất bại → hoàn tác
      const r2 = await app.run(`(async ()=>{ fkShrinkImage = ()=> Promise.resolve("data:image/jpeg;base64,BBBB"); const o = localStorage.setItem;
        localStorage.setItem = ()=>{ const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; };
        let ok; try{ ok = await fkSetAvatar({ type:"image/png", size: 100 }); } finally { localStorage.setItem = o; }
        const a = state.profile.avatarData; const ok2 = await fkSetAvatar({ type:"image/png", size: 100 }); return JSON.stringify([ok, a, ok2, state.profile.avatarData]); })()`);
      assert.deepEqual(JSON.parse(r2), [false, "data:image/png;base64,AAAA", true, "data:image/jpeg;base64,BBBB"]);
      // kết quả quá lớn bị từ chối
      const r3 = await app.run(`(async ()=>{ fkShrinkImage = ()=> Promise.resolve("data:image/jpeg;base64," + "A".repeat(300000)); return await fkSetAvatar({ type:"image/png", size: 100 }); })()`);
      assert.equal(r3, false);
    });
    t.test("R3-CORE-08: 1 URL blob cho mỗi video/ảnh (dùng lại giữa các lần vẽ), xoá thì thu hồi; không còn createObjectURL(rec.blob) rải rác", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      const src = read("app.js");
      assert.equal((src.match(/URL\.createObjectURL\(rec\.blob\)/g) || []).length, 1, "chỉ fkBlobUrl được tạo URL từ bản ghi IndexedDB");
      const r = await app.run(`(async ()=>{ let made = 0, revoked = []; const oC = URL.createObjectURL, oR = URL.revokeObjectURL;
        URL.createObjectURL = ()=> "blob:https://test.local/" + (++made); URL.revokeObjectURL = u=> revoked.push(u);
        let reads = 0; dbGetClip = async id=> { reads++; return id === 9 ? null : { id, blob:{}, name:"c" }; }; dbGetPhoto = async id=> ({ id, blob:{} });
        try{
          const a = await fkBlobUrl("clip", 1), b = await fkBlobUrl("clip", 1), c = await fkBlobUrl("clip", 2), p = await fkBlobUrl("photo", 1), none = await fkBlobUrl("clip", 9);
          fkBlobUrlDrop("clip", 1); const a2 = await fkBlobUrl("clip", 1);
          dbGetClip = async ()=>{ throw new Error("IndexedDB bị chặn"); }; const err = await fkBlobUrl("clip", 77);
          return JSON.stringify({ same: a === b, diff: a !== c && a !== p, none, made, revoked, renew: a2 !== a, err });
        } finally { URL.createObjectURL = oC; URL.revokeObjectURL = oR; } })()`);
      const o = JSON.parse(r);
      assert.equal(o.same, true); assert.equal(o.diff, true); assert.equal(o.none, null); assert.equal(o.err, null);
      assert.equal(o.made, 4); assert.deepEqual(o.revoked, ["blob:https://test.local/1"]); assert.equal(o.renew, true);
    });
    t.test("R3-CORE-15: IndexedDB dùng lại 1 kết nối; không có IndexedDB → lỗi tiếng Việt (không ReferenceError); goto() màn không tồn tại không ném lỗi", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      const r = await app.run(`(async ()=>{ let opens = 0; const fake = { close(){} };
        indexedDB = { open(){ opens++; const req = {}; setTimeout(()=>{ req.result = fake; req.onsuccess && req.onsuccess(); }, 0); return req; }, deleteDatabase(){} };
        _dbPromise = null; const a = await openDB(), b = await openDB(), c = await openDB();
        _dbPromise = null; indexedDB = undefined; let msg = ""; try{ await openDB(); }catch(e){ msg = e.message; }
        return JSON.stringify({ opens, same: a === b && b === c, msg }); })()`);
      const o = JSON.parse(r);
      assert.equal(o.opens, 1); assert.equal(o.same, true); assert.match(o.msg, /IndexedDB/);
      assert.doesNotThrow(()=> app.run(`goto("man-khong-ton-tai")`));
    });

    /* ======================= KHÔI PHỤC SAO LƯU ======================= */
    t.test("R3-CORE-03: khôi phục sao lưu — file hỏng / state không phải object / manifest sai bị từ chối TRƯỚC khi xoá kho video-ảnh; localStorage đầy → không mất gì", async ()=>{
      const app = await t.app({ state:{ profile: PROF({ name:"Giữ nguyên" }) } });
      const setup = (stateJson, manifestJson)=> app.run(`(()=>{ globalThis.__cleared = 0; globalThis.__puts = [];
        dbClear = async ()=>{ __cleared++; }; dbPutRaw = async (s, r)=>{ __puts.push([s, r.id, r.name]); };
        const files = { "state.json": ${JSON.stringify(stateJson)}, "db-manifest.json": ${JSON.stringify(manifestJson)}, "blobs/clips/5": "x", "blobs/photos/6": "y" };
        globalThis.JSZip = { loadAsync: async ()=> ({ file: n=> files[n] == null ? null : { async: async kind=> kind === "string" ? files[n] : new ArrayBuffer(2) } }) };
      })()`);
      const before = app.localStorage.getItem("fitkit_state_v1");
      const tryRestore = async ()=> app.run(`(async ()=>{ try{ await restoreFromBackupZip({}); return "ok"; }catch(e){ return "ERR:" + e.message; } })()`);
      for(const [sj, mj] of [["{hỏng", "[]"], ["null", "[]"], ["[1]", "[]"], [`"x"`, "[]"], [`{"onboarded":true}`, "{hỏng"], [`{"onboarded":true}`, `{"a":1}`]]){
        setup(sj, mj);
        const r = await tryRestore();
        assert.match(r, /^ERR:File sao lưu/, `${sj} | ${mj} → ${r}`);
        assert.equal(app.ev("__cleared"), 0, "đã xoá kho trước khi kiểm tra: " + sj);
        assert.equal(app.localStorage.getItem("fitkit_state_v1"), before);
      }
      // localStorage đầy → báo lỗi, chưa xoá gì
      setup(`{"onboarded":true,"profile":{"name":"Mới"}}`, `[{"store":"clips","id":5,"name":"c"}]`);
      const rq = await app.run(`(async ()=>{ const o = localStorage.setItem; localStorage.setItem = ()=>{ const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; };
        try{ await restoreFromBackupZip({}); return "ok"; }catch(e){ return "ERR:" + e.message; } finally { localStorage.setItem = o; } })()`);
      assert.match(rq, /^ERR:Bộ nhớ máy đầy/); assert.equal(app.ev("__cleared"), 0);
      assert.equal(app.localStorage.getItem("fitkit_state_v1"), before);
      // ghi video lỗi giữa chừng → trả lại state cũ
      setup(`{"onboarded":true,"profile":{"name":"Mới"}}`, `[{"store":"clips","id":5,"name":"c"}]`);
      const rw = await app.run(`(async ()=>{ dbPutRaw = async ()=>{ throw new Error("QuotaExceededError"); }; try{ await restoreFromBackupZip({}); return "ok"; }catch(e){ return "ERR:" + e.message; } })()`);
      assert.match(rw, /^ERR:Không ghi được video\/ảnh/);
      assert.equal(app.localStorage.getItem("fitkit_state_v1"), before, "state cũ phải được trả lại");
      // bản hợp lệ: manifest lọc mục rác, state được chuẩn hoá
      setup(`{"onboarded":true,"profile":{"name":"Mới","weight":"x"},"reminders":"hỏng","inbodyLogs":[{"id":"<img src=x onerror=alert(1)>","weight":"<b>"}]}`,
        `[{"store":"clips","id":5,"name":"c"},{"store":"../../x","id":1},{"store":"photos","id":"<b>"},null,{"store":"photos","id":6}]`);
      assert.equal(await tryRestore(), "ok");
      assert.equal(app.ev("__cleared"), 2);
      assert.deepEqual(app.evj("__puts").map(x=> x[1]), [5, 6]);
      const saved = JSON.parse(app.localStorage.getItem("fitkit_state_v1"));
      assert.equal(saved.profile.name, "Mới"); assert.equal(saved.profile.weight, 65);
      assert.equal(typeof saved.reminders, "object"); assert.equal(saved.inbodyLogs[0].weight, null);
      assert.ok(!DANGER.test(JSON.stringify(saved.inbodyLogs)));
    });

    /* ======================= INBODY / GIẤC NGỦ / NHẮC NHỞ ======================= */
    t.test("R3-CORE-11: số đo InBody — số âm / phi lý / ngày tương lai / ngày không có thật bị từ chối kèm lời tiếng Việt; dấu phẩy thập phân dùng được", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.setNow("2026-11-11T23:30");
      const rd = f=> app.evj(`fkInbodyRead(${JSON.stringify(f)})`);
      const ok = rd({ date:"2026-11-11", weight:"70,5", bf:"18,2", muscle:"32", water:"55", visceral:"8", note:"  đo sáng  " });
      assert.deepEqual([ok.log.weight, ok.log.bodyFatPct, ok.log.muscleMassKg, ok.log.bodyWaterPct, ok.log.visceralFat, ok.log.note], [70.5, 18.2, 32, 55, 8, "đo sáng"]);
      assert.equal(new Date(ok.log.ts).getHours(), 12, "giờ trưa địa phương — không lệch ngày theo múi giờ");
      assert.equal(new Date(ok.log.ts).getDate(), 11);
      assert.equal(rd({ date:"2026-11-11", weight:"" }).log.weight, 72, "để trống cân nặng → lấy cân trong hồ sơ");
      assert.equal(rd({ date:"", weight:"70" }).log.bodyFatPct, null);
      for(const f of [{ weight:"-70" }, { weight:"0" }, { weight:"9999" }, { weight:"abc" }, { weight:"70", bf:"150" }, { weight:"70", bf:"-1" }, { weight:"70", muscle:"80" },
        { weight:"70", water:"5" }, { weight:"70", visceral:"0" }, { weight:"70", date:"2026-11-12" }, { weight:"70", date:"2026-02-31" }, { weight:"70", date:"1899-01-01" }, { weight:"70", date:"rác" }]){
        const r = rd(f);
        assert.ok(r.error && !r.log, "phải từ chối: " + JSON.stringify(f));
        assert.ok(!/NaN|undefined/.test(r.error), r.error);
      }
      // lưu qua form: giá trị xấu không vào state, giá trị tốt thì vào
      const save = (w, bf)=> app.run(`(()=>{ openAddInbodyLog(); document.getElementById("ib-date").value = "2026-11-10"; document.getElementById("ib-weight").value = ${JSON.stringify(w)};
        document.getElementById("ib-bf").value = ${JSON.stringify(bf)}; ["ib-muscle","ib-water","ib-visceral","ib-note"].forEach(i=> document.getElementById(i).value = "");
        ${lastClick("ib-save")}; return state.inbodyLogs.length; })()`);
      assert.equal(save("-5", ""), 0);
      assert.match(app.dom.registry.get("ib-err").textContent, /20–350/);
      assert.equal(save("70", "999"), 0);
      assert.equal(save("70,4", "17,5"), 1);
      assert.deepEqual(app.evj("[state.inbodyLogs[0].weight, state.inbodyLogs[0].bodyFatPct, state.inbodyLogs[0].source]"), [70.4, 17.5, "manual"]);
    });
    t.test("R3-CORE-10: giấc ngủ — ô giờ trống không lưu 'NaN giờ'; mục tiêu kẹp 4–12; nhãn thứ tính theo ngày địa phương; qua nửa đêm đúng", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.setNow("2026-11-11T07:30");
      assert.ok(Number.isNaN(app.call("sleepHours", "", "07:00"))); assert.ok(Number.isNaN(app.call("sleepHours", "25:00", "07:00"))); assert.ok(Number.isNaN(app.call("sleepHours", "23:00", undefined)));
      assert.equal(app.call("sleepHours", "23:00", "06:30"), 7.5); assert.equal(app.call("sleepHours", "00:15", "07:15"), 7); assert.equal(app.call("sleepHours", "13:00", "13:30"), 0.5);
      const save = (a, b)=> app.run(`(()=>{ document.getElementById("sleep-start").value = ${JSON.stringify(a)}; document.getElementById("sleep-end").value = ${JSON.stringify(b)};
        ${lastClick("btn-save-sleep")}; return JSON.stringify(state.sleepLog["2026-11-11"] || null); })()`);
      assert.equal(save("", "07:00"), "null");
      assert.match(app.lastHtml("toast"), /giờ đi ngủ/);
      assert.equal(JSON.parse(save("23:00", "06:30")).hours, 7.5);
      // dữ liệu cũ NaN không làm hỏng trung bình
      app.run(`state.sleepLog["2026-11-10"] = { hours: NaN }; state.sleepLog["2026-11-09"] = { hours: "x" }; renderSleepScreen();`);
      assert.equal(app.dom.registry.get("sleep-avg").textContent, "7.5h");
      assert.ok(!/NaN/.test(app.lastHtml("sleep-bars")));
      // nhãn thứ: 11/11/2026 là thứ Tư → cột cuối "T4"
      const labels = [...app.lastHtml("sleep-bars").matchAll(/>(T\d|CN)<\/span>/g)].map(m=> m[1]);
      assert.deepEqual(labels, ["T5","T6","T7","CN","T2","T3","T4"]);
      assert.ok(!/new Date\(d\)\.getDay\(\)/.test(read("app.js")), "không dùng new Date('YYYY-MM-DD') (UTC) để lấy thứ");
      // mục tiêu
      const goal = v=> app.run(`(()=>{ ${lastClick("btn-edit-sleep-goal")}; document.getElementById("sleep-goal-input").value = ${JSON.stringify(v)}; ${lastClick("btn-save-sleep-goal")}; return state.profile.sleepGoalHours; })()`);
      assert.equal(goal("7.5"), 7.5); assert.equal(goal("-3"), 7.5); assert.equal(goal("100"), 7.5); assert.equal(goal("abc"), 7.5); assert.equal(goal("9"), 9);
    });
    t.test("R3-CORE-12: nhắc nhở — không có giáo án không ném lỗi; trễ ≤ 3 phút vẫn bắn (tab nền bị bóp timer), mỗi nhắc 1 lần/ngày; giờ trống không lưu", async ()=>{
      const app = await t.app({ state:{ profile: PROF(), reminders:{ master:true, workout:{}, meal:{ breakfast:{ enabled:true, time:"07:00" } }, bedtimeEnabled:true, bedtimeTime:"22:30" } } });
      const at = hm=> app.evj(`fkReminderDue("07:00", new Date("2026-11-11T${hm}:00"))`);
      assert.deepEqual([at("06:59"), at("07:00"), at("07:03"), at("07:04"), at("23:59")], [false, true, true, false, false]);
      assert.equal(app.evj(`fkReminderDue("", new Date())`), false); assert.equal(app.evj(`fkReminderDue("7h", new Date())`), false); assert.equal(app.evj(`fkReminderDue(null, new Date())`), false);
      app.setNow("2026-11-11T07:02:10");            // trượt mất phút 07:00
      app.run(`document.getElementById("toast").innerHTML = ""`);
      app.call("checkReminders");
      assert.match(app.lastHtml("toast"), /bữa sáng|Đừng quên/i);
      assert.deepEqual(app.evj("Object.keys(state._firedKeys)"), ["2026-11-11_07:00_meal_breakfast"]);
      app.run(`document.getElementById("toast").innerHTML = ""`);
      app.setNow("2026-11-11T07:03:00"); app.call("checkReminders");
      assert.equal(app.lastHtml("toast"), "", "không bắn lần 2 trong cùng ngày");
      // sang ngày mới: khoá cũ được dọn, bắn lại
      app.setNow("2026-11-12T07:00:20"); app.call("checkReminders");
      assert.deepEqual(app.evj("Object.keys(state._firedKeys)"), ["2026-11-12_07:00_meal_breakfast"]);
      // không có giáo án / ngày tập
      app.run(`state.reminders.workout = { T5:{ enabled:true, time:"07:00" } }; state.plans = {}; state.activePlanId = null;`);
      assert.doesNotThrow(()=> app.call("checkReminders"));
      assert.doesNotThrow(()=> app.run(`state.reminders.workout = null; state.reminders.meal = null; checkReminders(); state.reminders.workout = {}; state.reminders.meal = {}; ensureReminderDefaults();`));
      // giờ trống không được lưu
      const r = app.run(`(()=>{ ensurePlans(); openEditReminderTime("meal", "lunch"); const before = state.reminders.meal.lunch.time; document.getElementById("time-picker").value = "";
        ${lastClick("btn-save-time")}; return JSON.stringify([before, state.reminders.meal.lunch.time]); })()`);
      const [b, a] = JSON.parse(r); assert.equal(a, b);
    });

    /* ======================= KHÁC ======================= */
    t.test("R3-CORE-14: lưu video thất bại (bộ nhớ đầy / IndexedDB bị chặn) → báo lỗi rõ, không thêm mục 'ma' vào kho, nút bấm lại được; tệp không phải video / > 300 MB bị từ chối", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      const realCreate = URL.createObjectURL;                    // URL của Node dùng chung với sandbox → trả lại sau test
      URL.createObjectURL = ()=> "blob:https://test.local/p";
      try{
      const pick = f=> app.run(`(()=>{ openUploadClip(()=>{ globalThis.__done = true; }, "gym"); const btn = document.getElementById("btn-confirm-upload"); btn.disabled = true;
        document.getElementById("clip-input")._listeners.change.slice(-1)[0]({ target:{ files:[${f}], value:"x" } }); return btn.disabled; })()`);
      assert.equal(pick(`{ name:"a.pdf", type:"application/pdf", size: 10 }`), true);
      assert.match(app.lastHtml("toast"), /tệp video/);
      assert.equal(pick(`{ name:"a.mp4", type:"video/mp4", size: 400*1024*1024 }`), true);
      assert.match(app.lastHtml("toast"), /300 MB/);
      assert.equal(pick(`{ name:"a.mp4", type:"video/mp4", size: 1000 }`), false);
      const r = await app.run(`(async ()=>{ dbAddClip = async ()=>{ const e = new Error("full"); e.name = "QuotaExceededError"; throw e; };
        await ${lastClick("btn-confirm-upload")}; const btn = document.getElementById("btn-confirm-upload"); return JSON.stringify([state.videoLibrary.length, btn.disabled, !!globalThis.__done]); })()`);
      assert.deepEqual(JSON.parse(r), [0, false, false]);
      assert.match(app.lastHtml("toast"), /Bộ nhớ máy đầy/);
      const r2 = await app.run(`(async ()=>{ dbAddClip = async ()=> 11; await ${lastClick("btn-confirm-upload")}; return JSON.stringify([state.videoLibrary.map(v=> v.id), !!globalThis.__done]); })()`);
      assert.deepEqual(JSON.parse(r2), [[11], true]);
      } finally { URL.createObjectURL = realCreate; }
    });
    t.test("R3-CORE-08: xoá video khỏi kho → gỡ khỏi mọi bài đang gắn (không còn khung video đen trỏ tới clip đã xoá)", async ()=>{
      const app = await t.app({ state:{ profile: PROF(), videoLibrary:[{ id:4, name:"v", category:"gym" }] } });
      app.setNow(WED); const pid = app.run(PLAN(3, 60));
      const r = await app.run(`(async ()=>{ state.plans["${pid}"].days.T4.items[0].clipId = 4; state.plans["${pid}"].days.T4.items[1].clipId = 5; dbDeleteClip = async ()=>{ throw new Error("x"); };
        const grid = document.getElementById("clip-grid"); let cb = null; const oq = grid.querySelectorAll;
        grid.querySelectorAll = sel=> sel === "[data-del]" ? [{ dataset:{ del:"4" }, addEventListener(t, fn){ cb = fn; } }] : [];
        const oc = confirmDialog; let run = null; confirmDialog = (a, b, fn)=>{ run = fn; };
        try{ bindClipGrid(grid, ()=>{}); cb({ stopPropagation(){} }); await run(); } finally { grid.querySelectorAll = oq; confirmDialog = oc; }
        const it = state.plans["${pid}"].days.T4.items; return JSON.stringify([state.videoLibrary.length, it[0].clipId, it[1].clipId]); })()`);
      assert.deepEqual(JSON.parse(r), [0, null, 5]);
    });
    t.test("R3-CORE-16: kỷ lục số lần (AMRAP) của buổi qua nửa đêm ghi theo ngày bắt đầu buổi (session.date)", async ()=>{
      const src = read("training-pro.js");
      const fn = src.slice(src.indexOf("function afterRecord("), src.indexOf("function buildSummary("));
      assert.ok(/s\.date/.test(fn) && !/const today = dstr\(new Date\(\)\);/.test(fn), "afterRecord phải dùng s.date");
    });
    t.test("R3-CORE: e1RM / tự tăng–giảm tạ chịu được đầu vào xấu (âm, NaN, chuỗi, cực lớn) — không NaN, không âm", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      for(const [kg, reps] of [[-50, 5], [NaN, 5], ["abc", 5], [100, -3], [100, NaN], [0, 10], [100, 0], [null, null]]) assert.equal(app.call("e1rm", kg, reps), 0, `${kg}×${reps}`);
      assert.equal(app.call("e1rm", 100, 1), 100); assert.equal(Math.round(app.call("e1rm", 100, 10) * 10) / 10, 133.3);
      assert.equal(app.call("e1rm", 100, 50), app.call("e1rm", 100, 12), "trần 12 lần");
      assert.equal(app.call("e1rm", "100", "5"), app.call("e1rm", 100, 5));
      const meta = { equipment:"Thanh đòn", muscle:"Ngực" };
      for(const kg of [-10, NaN, "x", 0, null]){ const n = app.call("fkNextKg", meta, kg); assert.ok(Number.isFinite(n) && n > 0, "fkNextKg " + kg + " → " + n); assert.equal(app.call("fkDeloadKg", meta, kg), null); }
      const big = app.call("fkNextKg", meta, 1e6); assert.ok(Number.isFinite(big) && big > 1e6);
      const prog = app.evj(`progressionFor({ reps:"8-12", sets:3 }, { equipment:"Thanh đòn", muscle:"Ngực" }, { date:"2026-01-01", sets:[{ kg:"x", reps:NaN }, { kg:-5, reps:"12" }, null].filter(Boolean) }, false, 3)`);
      assert.equal(prog.delta, 0);
      // ghi kết quả với số xấu không tạo NaN trong lịch sử
      app.setNow(WED);
      app.run(`recordExerciseResult("benchpress", "Đẩy ngực", "8-12", [{ kg:"abc", reps:"x" }, { kg:-20, reps:-3 }, { kg:60, reps:10 }], false)`);
      const h = app.evj(`state.setHist.benchpress.list[0]`);
      assert.ok(Number.isFinite(h.e1rm) && Number.isFinite(h.vol) && Number.isFinite(h.top) && h.e1rm >= 0 && h.vol >= 0, JSON.stringify(h));
      assert.ok(!/NaN|null/.test(JSON.stringify(h.sets.map(x=> [x.kg, x.reps]))), JSON.stringify(h.sets));
    });
    t.test("R3-CORE: chuỗi ngày tập (streak) — finishedDates trùng / rác không đếm đôi; qua nửa đêm chuỗi không đứt khi hôm nay chưa tập", async ()=>{
      const app = await t.app({ state:{ profile: PROF(), finishedDates:["2026-11-09","2026-11-10","2026-11-10","rác",null,"2026-11-10"] } });
      app.setNow("2026-11-11T00:05");            // vừa qua nửa đêm thứ Tư, chưa tập
      app.run(`(()=>{ const p = createBlankPlan("S"); ["T2","T3","T4"].forEach(k=> p.days[k].items = [{ uid:k, exerciseId:"pushup", sets:3, reps:"10", restSec:60 }]); state.activePlanId = p.id; })()`);
      assert.deepEqual(app.evj("state.finishedDates"), ["2026-11-09","2026-11-10"]);
      assert.equal(app.call("calcStreak"), 2);
      app.setNow("2026-11-11T23:59"); assert.equal(app.call("calcStreak"), 2, "cuối ngày chưa tập: chuỗi chưa đứt");
      app.setNow("2026-11-12T00:01"); assert.equal(app.call("calcStreak"), 0, "bỏ lỡ thứ Tư có lịch → đứt chuỗi (thứ Năm là ngày nghỉ)");
    });
  },
};

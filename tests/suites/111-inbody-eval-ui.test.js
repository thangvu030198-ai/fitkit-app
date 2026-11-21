/* 21/11/2026 — InBody đầy đủ: lưu chỉ số mở rộng + từng phần + đánh giá AI; đánh giá bằng luật; phiếu chi tiết + hình giải phẫu theo giới tính */
"use strict";
const { assert } = require("../lib/framework");
const DAY = 86400000;
module.exports = {
  name: "InBody: lưu đủ chỉ số, đánh giá & tư vấn, phiếu chi tiết + hình giải phẫu nam/nữ",
  area: "inbody-scan.js",
  async define(t){
    const app = await t.app();

    t.test("IBE-01: clean() nhận trường mới (ffm, ecw_ratio 3 số lẻ, seg_*, eval) — sai/thiếu → null", ()=>{
      const r = app.evj(`FKInbody.clean(Object.assign(FKInbody.demoResult(), { ecw_ratio:"0.3814", ffm: 999, seg_fat:"x", eval:{ summary:"<b>ok</b>", status:{ fat:"evil" } } }))`);
      assert.equal(r.ecw_ratio, 0.381); assert.equal(r.ffm, null); assert.equal(r.seg_fat, null);
      assert.equal(r.seg_lean.ra.kg, 3.4); assert.equal(r.seg_lean.tr.pct, 99.4);
      assert.equal(r.eval.summary, "ok"); assert.equal(r.eval.status.fat, null);
      const old = app.evj(`FKInbody.clean({ weight:70, smm:30 })`);
      assert.equal(old.seg_lean, null); assert.equal(old.eval, null); assert.equal(old.protein, null);
    });

    t.test("IBE-02: gửi kèm hồ sơ + ≤6 lần đo trước khi gọi analyzeInbodyReport", async ()=>{
      app.ev(`state.profile.gender = "female"; state.profile.age = 30; state.profile.height = 160; state.profile.goal = "lose";
        state.inbodyLogs = Array.from({ length: 8 }, (_, i)=> ({ id:"h" + i, ts: Date.UTC(2026, 2 + i, 1), weight: 60 - i * 0.3, muscleMassKg: 22, bodyFatPct: 30 - i * 0.2 }))`);
      const ctx = app.evj(`FKInbody.scanContext()`);
      assert.deepEqual(ctx.profile, { gender:"female", age:30, height:160, goal:"lose" });
      assert.equal(ctx.history.length, 6); assert.equal(ctx.history[5].date, "2026-10-01"); assert.equal(ctx.history[5].smm, 22);
      /* đường khoá AI riêng (không phải firebase): lời nhắc kèm profile + history; máy chủ: tham số gọi hàm */
      const got = await app.ev(`(async()=>{ const k0 = getActiveProviderKey, v0 = callVisionAI; let pr = "";
        getActiveProviderKey = ()=> "k"; callVisionAI = async (u, p)=>{ pr = p; return JSON.stringify(FKInbody.demoResult()); };
        try{ const r = await FKInbody.analyze("data:image/jpeg;base64,AAAA"); return JSON.stringify({ pr, seg: !!r.seg_lean, ev: !!r.eval }); } finally { getActiveProviderKey = k0; callVisionAI = v0; } })()`);
      const g = JSON.parse(got);
      assert.ok(/profile=\{"gender":"female","age":30,"height":160,"goal":"lose"\}/.test(g.pr), g.pr.slice(-300));
      assert.ok(/history=\[/.test(g.pr) && /seg_lean/.test(g.pr) && /"eval"/.test(g.pr));
      assert.equal(g.seg, true); assert.equal(g.ev, true);
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "inbody-scan.js"), "utf8");
      assert.match(src, /c\.fn\("analyzeInbodyReport", \{ image: dataUrl, profile: ctx\.profile, history: ctx\.history \}\)/);
    });

    t.test("IBE-03: lưu từ phiếu → bản ghi có ĐỦ trường mới (camelCase) + giới tính; nạp lại vẫn giữ; màn duyệt có thẻ đánh giá", ()=>{
      app.ev(`state.profile.gender = "male"`);
      const l = app.evj(`(()=>{ const r = FKInbody.clean(FKInbody.demoResult()); const log = { id:"s1", ts: Date.UTC(2026,10,20), source:"manual", weight:72.4, bodyFatPct:18.8, muscleMassKg:33.1, bodyWaterPct:58.8, visceralFat:6, note:"" };
        return FKInbody.attachExtra(log, { fatMassKg:13.6, bmr:1685, score:78 }, r, r.device); })()`);
      assert.equal(l.weight, 72.4); assert.equal(l.fatMassKg, 13.6); assert.equal(l.device, "InBody 570 (kết quả mẫu)");
      ["ffmKg", "slmKg", "proteinKg", "mineralsKg", "tbwL", "ecwRatio", "smi", "whr", "obesityDegree", "targetWeight", "weightControl", "fatControl", "bmi"].forEach(k=> assert.ok(l[k] != null, k));
      assert.equal(l.ecwRatio, 0.381); assert.equal(l.muscleControl, 0); assert.equal(l.gender, "male"); assert.equal(l.scan, true);
      assert.equal(l.segLean.ll.pct, 95.6); assert.equal(l.segFat.tr.pct, 121.5);
      assert.ok(l.eval && l.eval.summary && l.eval.advice.length === 3 && l.eval.nextCheckDays === 28 && l.eval.src === "ai");
      const again = app.evj(`(()=>{ const s = { inbodyLogs: [${JSON.stringify(l)}] }; normalizeState(s); return s.inbodyLogs[0]; })()`);
      assert.deepEqual(again, l, "nạp lại state giữ nguyên");
      const card = app.ev(`FKInbody.evalCardHTML(Object.assign({ src:"ai" }, FKInbody.clean(FKInbody.demoResult()).eval), { ts: Date.UTC(2026,10,20) })`);
      ["Đánh giá của AI", "Điểm tốt", "Cần cải thiện", "Lời khuyên", "Đo lại sau khoảng", "28 ngày", "Cân nặng: <b>Chuẩn</b>"].forEach(x=> assert.ok(card.includes(x), x));
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "inbody-scan.js"), "utf8");
      assert.ok(/attachExtra\(l, extra, res, dev\)/.test(src) && /if\(res\) try\{ openReport\(l\.id\)/.test(src), "lưu xong mở phiếu chi tiết");
      assert.ok(/evalCardHTML\(ev, \{ compact: true \}\)/.test(src), "màn duyệt có thẻ đánh giá");
      assert.ok(!/inbodyLogs\.push/.test(src), "vẫn không tự thêm lần đo");
    });

    t.test("IBE-04: người dùng sửa cân khác số AI đọc → bỏ đánh giá AI (dùng luật), vẫn lưu từng phần", ()=>{
      const o = app.evj(`FKInbody.scanToLog(FKInbody.clean(FKInbody.demoResult()), { weight: 80, bodyFatPct: 18.8, muscleMassKg: 33.1 })`);
      assert.equal(o.eval, undefined); assert.ok(o.segLean); assert.equal(o.tbwL, undefined);
    });

    t.test("IBE-05: chuẩn hoá chống dữ liệu độc (XSS trong eval/summary, số ngoài khoảng, kiểu sai) — bản ghi cũ vẫn chạy", ()=>{
      const s = app.evj(`(()=>{ const s = { inbodyLogs:[
        { id:"x1", ts: 5, weight: 70, ffmKg: 9999, ecwRatio:"0.3814", whr: {}, gender:"alien", scan:"yes",
          segLean:{ ra:{ kg:"3.2", pct: 9999 }, tr:"<b>" }, segFat: [1, 2],
          eval:{ summary:'<img src=x onerror=alert(1)>Tốt', advice:["<script>alert(1)</script>Ăn đủ đạm", 5, null], good:"x", status:{ fat:"evil", muscle:"high" }, next_check_days: 9999, compare:"<svg onload=1>" } },
        { id:"old", ts: 1, weight: 68, bodyFatPct: 20, muscleMassKg: 30 } ] }; normalizeState(s); return s; })()`);
      const a = s.inbodyLogs[0];
      assert.equal(a.ffmKg, undefined); assert.equal(a.ecwRatio, 0.381); assert.equal(a.whr, undefined); assert.equal(a.gender, undefined); assert.equal(a.scan, undefined);
      assert.equal(a.segLean.ra.kg, 3.2); assert.equal(a.segLean.ra.pct, null); assert.equal(a.segLean.tr.kg, null); assert.equal(a.segFat, undefined);
      assert.ok(!/[<>]/.test(JSON.stringify(a.eval)), "không còn thẻ HTML");
      assert.equal(a.eval.summary, "Tốt"); assert.deepEqual(a.eval.advice, ["alert(1) Ăn đủ đạm"]); assert.equal(a.eval.compare, null);
      assert.deepEqual(a.eval.good, []); assert.equal(a.eval.status.fat, null); assert.equal(a.eval.status.muscle, "high"); assert.equal(a.eval.nextCheckDays, null);
      assert.deepEqual(Object.keys(s.inbodyLogs[1]).sort(), ["bodyFatPct", "bodyWaterPct", "id", "muscleMassKg", "note", "source", "ts", "visceralFat", "weight"].sort());
      // phiếu chi tiết của bản ghi độc: mọi chuỗi qua escape
      app.ev(`state.inbodyLogs = [{ id:"z", ts: Date.UTC(2026,10,1), weight:70, bodyFatPct:20, muscleMassKg:31, device:'<img src=x onerror=alert(2)>', note:"", eval:{ summary:'<img src=x onerror=alert(3)>', advice:['"><svg onload=alert(4)>'], src:"ai" } }]`);
      const html = app.ev(`FKInbody.reportHTML(state.inbodyLogs[0], state.inbodyLogs, "lean")`);
      assert.ok(!/<img|<svg onload/i.test(html), "không chèn thẻ thô");
      assert.ok(/&lt;img/.test(html));
    });

    t.test("IBE-06: đánh giá bằng LUẬT — 30 ngày giảm 0,2 kg, mục tiêu giảm mỡ → chững lại + lời khuyên cụ thể", ()=>{
      const logs = `[{ id:"a", ts: Date.UTC(2026,9,1), weight: 80, bodyFatPct: 26, muscleMassKg: 33, visceralFat: 11, gender:"male" },
                     { id:"b", ts: Date.UTC(2026,9,31), weight: 79.8, bodyFatPct: 25.8, muscleMassKg: 33, visceralFat: 11, gender:"male" }]`;
      const ev = app.evj(`FKInbody.ruleEval(${logs}[1], ${logs}, { gender:"male", height: 175, goal:"lose", tdee: 2600, weight: 80 })`);
      assert.equal(ev.src, "rule");
      assert.equal(ev.status.fat, "high"); assert.equal(ev.status.visceral, "high");
      assert.ok(/30 ngày/.test(ev.summary) && /chững lại/.test(ev.summary), ev.summary);
      const adv = ev.advice.join(" | ");
      assert.ok(/300–500 kcal/.test(adv) && /2100–2300 kcal/.test(adv), adv);
      assert.ok(/1,6–2,2 g\/kg/.test(adv) && /tăng tải/.test(adv) && /7–9 giờ/.test(adv), adv);
      assert.ok(/So với lần trước \(30 ngày\)/.test(ev.compare) && /−0,2 kg/.test(ev.compare), ev.compare);
      assert.equal(ev.nextCheckDays, 28);
      // nữ: % mỡ 24 là chuẩn (18–28), nam là cao
      assert.equal(app.evj(`FKInbody.statusOf({ weight:58, bodyFatPct:24, muscleMassKg:22 }, { gender:"female", height:160 })`).fat, "normal");
      assert.equal(app.evj(`FKInbody.statusOf({ weight:58, bodyFatPct:24, muscleMassKg:22 }, { gender:"male", height:160 })`).fat, "high");
      // mục tiêu tăng cơ, chững lại
      const g = app.evj(`FKInbody.progress([{ ts:0, weight:65, muscleMassKg:29 }, { ts:${35 * DAY}, weight:65.1, muscleMassKg:29.1 }], { goal:"gain" })`);
      assert.equal(g.plateau, true); assert.ok(g.advice.some(x=> /200–300 kcal/.test(x)));
      // mới cách 10 ngày → nhắc đo lại sau 3–4 tuần, không kết luận chững
      const s = app.evj(`FKInbody.progress([{ ts:0, weight:65 }, { ts:${10 * DAY}, weight:65 }], { goal:"lose" })`);
      assert.equal(s.plateau, false); assert.ok(/3–4 tuần/.test(s.notes[0]));
      // không có eval AI → evalFor dùng luật; có → dùng AI
      assert.equal(app.evj(`FKInbody.evalFor({ ts:1, weight:70 }, [], {})`).src, "rule");
      assert.equal(app.evj(`FKInbody.evalFor({ ts:1, weight:70, eval:{ summary:"x", advice:[] } }, [], {})`).src, "ai");
      assert.ok(/không thay thế tư vấn y khoa/i.test(app.ev(`FKInbody.evalCardHTML(FKInbody.ruleEval({ ts:1, weight:70, bodyFatPct:15 }, [], { gender:"male" }))`)));
    });

    t.test("IBE-07: hình giải phẫu SVG nam/nữ — 5 vùng, khác dáng, tô theo % (thấp/chuẩn/cao), thiếu từng phần → xám", ()=>{
      const seg = `{ ra:{kg:3.4,pct:104}, la:{kg:3.1,pct:86}, tr:{kg:26,pct:99}, rl:{kg:9.1,pct:115}, ll:{kg:9,pct:95} }`;
      const m = app.ev(`FKInbody.bodySVG("male", ${seg}, "lean")`), f = app.ev(`FKInbody.bodySVG("female", ${seg}, "lean")`);
      for(const svg of [m, f]){
        assert.ok(/^<svg/.test(svg.trim()));
        const segs = [...svg.matchAll(/data-seg="(\w+)"/g)].map(x=> x[1]).sort();
        assert.deepEqual(segs, ["la", "ll", "ra", "rl", "tr"]);
        assert.ok(/data-seg="la" data-tone="low"/.test(svg) && /data-seg="rl" data-tone="high"/.test(svg) && /data-seg="ra" data-tone="ok"/.test(svg));
        assert.ok(/>P<\/text>/.test(svg) && />T<\/text>/.test(svg) && /Tay P/.test(svg) && /Chân T/.test(svg));
      }
      assert.ok(/data-gender="male"/.test(m) && /data-gender="female"/.test(f));
      const d = (svg, k)=> (new RegExp(`d="([^"]+)" class="ibs-r[^"]*" data-seg="${k}"`).exec(svg) || [])[1];
      assert.notEqual(d(m, "tr"), d(f, "tr"), "thân nam/nữ khác dáng"); assert.notEqual(d(m, "rl"), d(f, "rl"));
      // tay phải của người nằm bên TRÁI hình
      const minX = path=> Math.min(...path.match(/[\d.]+,[\d.]+/g).map(p=> +p.split(",")[0]));
      assert.ok(minX(d(m, "ra")) < minX(d(m, "la")), "tay P bên trái hình");
      const none = app.ev(`FKInbody.bodySVG("female", null, "fat")`);
      assert.equal([...none.matchAll(/data-tone="na"/g)].length, 5);
      app.ev(`state.inbodyLogs = [{ id:"n1", ts: Date.UTC(2026,10,1), weight:58, bodyFatPct:24, muscleMassKg:22, gender:"female", note:"" }]`);
      const rep = app.ev(`FKInbody.reportHTML(state.inbodyLogs[0], state.inbodyLogs, "lean")`);
      assert.ok(/Phiếu không có phân tích từng phần/.test(rep) && /data-gender="female"/.test(rep));
      ["Thành phần cơ thể", "Phân tích cơ – mỡ", "Chỉ số béo phì", "Phân tích từng phần", "Lịch sử &amp; so sánh", "Đánh giá tự động"].forEach(h=> assert.ok(rep.includes(h), h));
    });

    t.test("IBE-08: phiếu chi tiết mở từ tab InBody + Trang chủ; tab Nạc/Mỡ; lịch sử Δ; thẻ trang chủ có dòng đánh giá", ()=>{
      app.ev(`state.profile.goal = "lose"; state.profile.gender = "male"; state.inbodyLogs = [
        { id:"p1", ts: Date.UTC(2026,8,1), weight: 80, bodyFatPct: 26, muscleMassKg: 33, note:"" },
        { id:"p2", ts: Date.UTC(2026,9,1), weight: 79.8, bodyFatPct: 25.9, muscleMassKg: 33, note:"",
          segLean:{ ra:{kg:3.4,pct:104}, la:{kg:3.4,pct:103}, tr:{kg:26,pct:99}, rl:{kg:9.1,pct:96}, ll:{kg:9,pct:95} },
          segFat:{ ra:{kg:0.9,pct:120}, la:{kg:0.9,pct:121}, tr:{kg:9,pct:150}, rl:{kg:2.4,pct:118}, ll:{kg:2.4,pct:118} } } ];
        progressUI.tab = "inbody"; goto("progress"); renderProgressScreen();`);
      const pc = app.ev(`document.getElementById("progress-content").innerHTML`);
      assert.ok(/data-iview="p1"/.test(pc) && /data-iview="p2"/.test(pc) && /data-idel="p2"/.test(pc), "mỗi dòng có Xem chi tiết + vẫn có Xoá");
      assert.equal(app.ev(`FKInbody.openReport("p2")`), true);
      const sc = ()=> app.ev(`document.getElementById("sheet-content").innerHTML`);
      assert.ok(/Phiếu thành phần cơ thể/.test(sc()) && /data-ibr="p2"/.test(sc()));
      assert.ok(/So với lần trước · 30 ngày/.test(sc()) && /chững lại/.test(sc()) && /<table class="ibr-tbl ibr-hist">/.test(sc()));
      assert.ok(/data-seg="tr" data-tone="ok"/.test(sc()));
      assert.ok(/data-seg="tr" data-tone="high"/.test(app.ev(`FKInbody.reportHTML(state.inbodyLogs[1], state.inbodyLogs, "fat")`)), "tab Mỡ từng phần");
      assert.equal(app.ev(`FKInbody.openReport("khong-co")`), false);
      app.ev(`closeSheet()`);
      const home = app.ev(`FKInbody.homeHTML(state.inbodyLogs)`);
      assert.ok(/class="ibh-eval"/.test(home) && /chững lại/.test(home) && /data-ibh="manage"/.test(home));
      app.ev(`FKInbody.openDetail()`);
      assert.equal(app.ev(`progressUI.tab`), "inbody");
      assert.ok(/data-ibr="p2"/.test(sc()), "Xem chi tiết → phiếu lần mới nhất");
      app.ev(`closeSheet()`);
      /* Trợ lý AI: câu hỏi tóm tắt các lần đo (nút ghi rõ tốn 1 lượt) */
      assert.ok(/79,8 kg/.test(app.ev(`FKInbody.coachQuestion(state.inbodyLogs[1], state.inbodyLogs)`)));
    });
    t.test("IBE-09: mở app với state đã lưu (trường mới) — nạp lúc khởi động giữ nguyên, không mất lần đo", async ()=>{
      const a2 = await t.app({ state:{ inbodyLogs:[{ id:"k1", ts: Date.UTC(2026,9,1), source:"manual", weight:70, bodyFatPct:18, muscleMassKg:32, note:"", gender:"female", proteinKg:10.2, ecwRatio:0.38,
        segLean:{ ra:{kg:2.1,pct:95}, la:{kg:2,pct:93}, tr:{kg:20,pct:100}, rl:{kg:7,pct:101}, ll:{kg:7,pct:100} }, eval:{ summary:"Ổn", advice:["Ngủ đủ"], status:{ fat:"normal" } } }] } });
      assert.equal(a2.loadErrors.length, 0);
      const l = a2.evj(`state.inbodyLogs[0]`);
      assert.equal(l.id, "k1"); assert.equal(l.proteinKg, 10.2); assert.equal(l.ecwRatio, 0.38); assert.equal(l.gender, "female");
      assert.equal(l.segLean.tr.kg, 20); assert.equal(l.eval.summary, "Ổn"); assert.equal(l.eval.src, "ai");
    });
  }
};

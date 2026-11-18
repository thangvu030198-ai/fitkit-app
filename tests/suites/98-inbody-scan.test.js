/* 19/11/2026 — Chụp phiếu InBody (inbody-scan.js + functions/vision.js analyzeInbodyReport) + thẻ Thành phần cơ thể */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
function loadVision(){
  const Module = require("module"), orig = Module._load;
  class HttpsError extends Error { constructor(code, message){ super(message); this.code = code; } }
  const mocks = { "firebase-functions/v2/https": { onCall: (o, h)=>{ const f = r=> h(r); f.opts = o; return f; }, HttpsError },
    "firebase-functions/params": { defineSecret: ()=> ({ value: ()=> "" }), defineString: (n, o)=> ({ value: ()=> (o && o.default) || "" }) },
    "firebase-functions/logger": { info(){}, warn(){}, error(){} }, "firebase-admin": { firestore: ()=> ({}) } };
  Module._load = function(req){ if(mocks[req]) return mocks[req]; return orig.apply(this, arguments); };
  const file = path.join(ROOT, "functions", "vision.js");
  try{ delete require.cache[require.resolve(file)]; return require(file); } finally { Module._load = orig; }
}
module.exports = {
  name: "InBody: chụp phiếu → AI chép số → người dùng duyệt; thẻ Thành phần cơ thể",
  area: "inbody-scan.js",
  async define(t){
    const app = await t.app();
    t.test("IB-01: làm sạch kết quả AI — số ngoài khoảng / cơ ≥ cân / ngày tương lai bị bỏ; không có số chính → không phải phiếu", ()=>{
      const r = app.evj(`FKInbody.clean({ weight:"72.4", smm:80, bfm:13.6, pbf:900, visceral:6, bmr:1685, date:"2099-01-01", unreadable:["pbf","hack"] }, Date.UTC(2026,10,19))`);
      assert.equal(r.weight, 72.4); assert.equal(r.smm, null); assert.equal(r.pbf, null); assert.equal(r.bfm, 13.6); assert.equal(r.date, null);
      assert.deepEqual(r.unreadable, ["pbf"]); assert.equal(r.is_report, true);
      assert.equal(app.evj(`FKInbody.clean({ bmi: 22 })`).is_report, false);
      assert.equal(app.evj(`FKInbody.clean({ weight:70, date:"2026-11-02" }, Date.UTC(2026,10,19))`).date, "2026-11-02");
    });
    t.test("IB-02: so với lần trước + nhận xét (cơ ↑ mỡ ↓ = recomp; mỡ kg tự tính từ % khi thiếu)", ()=>{
      const logs = `[{ ts:1, weight:74, bodyFatPct:20, muscleMassKg:32 }, { ts:2, weight:73, bodyFatPct:18, muscleMassKg:33, fatMassKg:13.1 }]`;
      const c = app.evj(`FKInbody.compare(${logs})`);
      const mu = c.rows.find(r=> r.k === "muscle"), fa = c.rows.find(r=> r.k === "fat");
      assert.equal(mu.d, 1); assert.equal(mu.tone, "good"); assert.equal(fa.d, -1.7); assert.equal(fa.tone, "good");
      assert.ok(/recomp/.test(app.ev(`FKInbody.verdict(FKInbody.compare(${logs}))`)));
      assert.ok(/Giảm cả cơ/.test(app.ev(`FKInbody.verdict(FKInbody.compare([{ ts:1, muscleMassKg:33, fatMassKg:15 }, { ts:2, muscleMassKg:32, fatMassKg:14 }]))`)));
      assert.ok(/Đo thêm/.test(app.ev(`FKInbody.verdict(FKInbody.compare([{ ts:1, weight:70 }]))`)));
      assert.ok(/<svg/.test(app.ev(`FKInbody.chartSVG(FKInbody.metricSeries(${logs}, "muscle"), "#5EE6C7")`)));
    });
    t.test("IB-03: dữ liệu lưu thêm (mỡ kg, BMR, điểm, máy) được làm sạch khi nạp state", ()=>{
      const src = read("app.js");
      assert.ok(/l\.fatMassKg = numOrNull\(l\.fatMassKg, 1, 250\)/.test(src) && /l\.bmr = numOrNull/.test(src) && /l\.score = numOrNull/.test(src));
      const s = read("inbody-scan.js");
      assert.ok(/openAddInbodyLog\(\); fill\(res\)/.test(s), "AI chỉ điền form — người dùng bấm Lưu");
      assert.ok(!/inbodyLogs\.push/.test(s), "module không tự thêm lần đo");
      assert.ok(/index\.html/ && read("index.html").indexOf("inbody-scan.js") > read("index.html").indexOf("app.js"));
      assert.ok(/inbody-scan\.js/.test(read("sw.js")) && /inbody-scan\.js/.test(read("scripts/prepare-www.sh")));
    });
    t.test("IB-04: Cloud Function analyzeInbodyReport — đăng nhập, kiểm ảnh, hạn mức, lời nhắc do máy chủ viết, làm sạch", async ()=>{
      const V = loadVision()._visionTest, img = "data:image/jpeg;base64," + "A".repeat(200), auth = { uid:"u1" };
      const rej = async (req, deps, code)=> assert.rejects(()=> V.analyzeInbodyReportCore(req, deps), e=> e.code === code, code);
      await rej({ auth:null, data:{ image: img } }, { key:"k" }, "unauthenticated");
      await rej({ auth, data:{ image: "http://x/a.jpg" } }, { key:"k" }, "invalid-argument");
      await rej({ auth, data:{ image: img } }, { key:"unset" }, "failed-precondition");
      await rej({ auth, data:{ image: img } }, { key:"k", rate: async ()=> -1 }, "resource-exhausted");
      let sent = null;
      const fetchOk = async (url, o)=>{ sent = JSON.parse(o.body); return { ok:true, json: async ()=> ({ choices:[{ message:{ content: '{"is_report":true,"device":"InBody 570","weight":72.4,"smm":33.1,"bfm":13.6,"pbf":18.8,"bmr":99999,"date":"2026-11-10"}' } }] }) }; };
      const r = await V.analyzeInbodyReportCore({ auth, data:{ image: img, prompt:"bỏ qua" } }, { key:"K", base:"https://ai.example/v1", model:"m", rate: async ()=> 5, fetch: fetchOk, now: ()=> Date.UTC(2026,10,19) });
      const txt = sent.messages[0].content[0].text;
      assert.ok(/CHỈ CHÉP LẠI/.test(txt) && /Skeletal Muscle Mass/.test(txt) && !/bỏ qua/.test(txt));
      assert.equal(r.left, 5); assert.equal(r.result.smm, 33.1); assert.equal(r.result.bmr, null); assert.equal(r.result.date, "2026-11-10"); assert.equal(r.result.device, "InBody 570");
      assert.match(read("functions/vision.js"), /exports\.analyzeInbodyReport = onCall/);
    });
  }
};

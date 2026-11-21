/* 21/11/2026 — functions/vision.js dùng chung cấu hình Trợ lý AI: ghép URL như aicoach, thử lại không response_format,
   thứ tự model dự phòng (visionModel → model → fallback → VISION_API cũ), hoàn lượt khi AI lỗi */
"use strict";
const { assert } = require("../lib/framework");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
function loadVision(params){
  const Module = require("module"), orig = Module._load;
  class HttpsError extends Error { constructor(code, message){ super(message); this.code = code; } }
  const P = params || {};
  const mocks = { "firebase-functions/v2/https": { onCall: (o, h)=>{ const f = r=> h(r); f.opts = o; return f; }, HttpsError },
    "firebase-functions/params": { defineSecret: n=> ({ value: ()=> P[n] || "" }), defineString: (n, o)=> ({ value: ()=> P[n] || (o && o.default) || "" }) },
    "firebase-functions/logger": { info(){}, warn(){}, error(){} }, "firebase-admin": { firestore: ()=> ({}) } };
  Module._load = function(req){ if(mocks[req]) return mocks[req]; return orig.apply(this, arguments); };
  const file = path.join(ROOT, "functions", "vision.js");
  try{ delete require.cache[require.resolve(file)]; return require(file); } finally { Module._load = orig; }
}
const okJson = content=> ({ ok: true, status: 200, json: async ()=> ({ choices: [{ message: { content } }] }), text: async ()=> content });
const bad = (status, body)=> ({ ok: false, status, text: async ()=> body || "err", json: async ()=> ({}) });
const FOOD = '{"is_food":true,"dish":"Cơm","items":[{"name":"Cơm","grams":150}]}';
const img = "data:image/jpeg;base64," + "A".repeat(200), auth = { uid: "u1" };
function fakeDb(docs){
  return { collection: c=> ({ doc: id=> ({ get: async ()=> { const d = docs[c + "/" + id]; return { exists: !!d, data: ()=> d }; } }) }) };
}

module.exports = {
  name: "AI đọc ảnh dùng chung cấu hình Trợ lý AI (vision.js)",
  area: "functions/vision.js",
  async define(t){
    t.test("VIS-01: ghép URL giống aicoach — baseUrl có /chat/completions, dấu / thừa; header Bearer", async ()=>{
      const V = loadVision()._visionTest;
      assert.equal(V.cleanBase("https://api.x.com/v1/chat/completions/"), "https://api.x.com/v1");
      assert.equal(V.cleanBase("https://api.x.com/v1/models"), "https://api.x.com/v1");
      assert.equal(V.cleanBase("http://api.x.com/v1"), ""); assert.equal(V.cleanBase("https://127.0.0.1/v1"), "");
      const calls = [];
      const fetch = async (url, o)=>{ calls.push({ url, auth: o.headers.Authorization }); return okJson(FOOD); };
      const r = await V.analyzeFoodPhotoCore({ auth, data: { images: [img] } }, { key: "KEY1", base: "https://api.x.com/v1/chat/completions", model: "m", rate: async ()=> 3, fetch });
      assert.equal(calls.length, 1); assert.equal(calls[0].url, "https://api.x.com/v1/chat/completions"); assert.equal(calls[0].auth, "Bearer KEY1");
      assert.equal(r.left, 3); assert.equal(r.result.items[0].grams, 150);
    });
    t.test("VIS-02: nhà cung cấp từ chối response_format (400) → gọi lại không kèm; model sau cùng nhà cung cấp cũng không gửi nữa", async ()=>{
      const V = loadVision()._visionTest, bodies = [];
      const fetch = async (url, o)=>{ const b = JSON.parse(o.body); bodies.push(b);
        if(b.response_format) return bad(400, "response_format not supported");
        if(b.model === "m1") return bad(500, "boom");
        return okJson("Kết quả: " + FOOD); };
      const r = await V.analyzeFoodPhotoCore({ auth, data: { images: [img] } }, { key: "K", base: "https://api.x.com/v1", models: ["m1", "m2"], rate: async ()=> 2, fetch });
      assert.equal(bodies.length, 3);
      assert.ok(bodies[0].response_format && !bodies[1].response_format && bodies[1].model === "m1");
      assert.ok(!bodies[2].response_format && bodies[2].model === "m2");
      assert.equal(r.result.dish, "Cơm");
    });
    t.test("VIS-03: thứ tự dự phòng visionModel → model → fallback → VISION_API cũ; 401 bỏ qua model còn lại; lỗi hết → hoàn lượt", async ()=>{
      const V = loadVision({ VISION_API_KEY: "OLDKEY-123456", VISION_API_BASE: "https://old.example/v1beta/openai/", VISION_MODEL: "gem" })._visionTest;
      const ai = await V.sharedAi(fakeDb({ "ai_config/main": { baseUrl: "https://new.example/v1", model: "chat-m", visionModel: "vis-m", fallback: "fb-m", dailyLimit: 7 }, "ai_secret/main": { key: "NEWKEY-123456" } }));
      assert.equal(ai.limit, 7);
      assert.deepEqual(ai.providers.map(p=> [p.base, p.models.join(",")]), [["https://new.example/v1", "vis-m,chat-m,fb-m"], ["https://old.example/v1beta/openai", "gem"]]);
      const seen = [];
      const fetch = async (url, o)=>{ const b = JSON.parse(o.body); seen.push(b.model + "@" + new URL(url).host + (b.response_format ? "+rf" : ""));
        if(b.model === "vis-m") return bad(404, "model not found"); if(b.model === "chat-m") return bad(400, "image input not supported");
        if(b.model === "fb-m") return bad(503, "overloaded"); return okJson(FOOD); };
      const out = await V.runVision([img], "p", ai.providers, { fetch }, "t");
      assert.deepEqual(seen, ["vis-m@new.example+rf", "chat-m@new.example+rf", "chat-m@new.example", "fb-m@new.example", "gem@old.example+rf"]);
      assert.equal(out.model, "gem"); assert.equal(out.host, "old.example");
      // 401 ở nhà cung cấp chung → không thử model khác của nó, sang thẳng VISION_API cũ
      const seen2 = [];
      await V.runVision([img], "p", ai.providers, { fetch: async (url, o)=>{ const b = JSON.parse(o.body); seen2.push(b.model); return b.model === "gem" ? okJson(FOOD) : bad(401, "bad key"); } }, "t");
      assert.deepEqual(seen2, ["vis-m", "gem"]);
      // không có khoá chung → chỉ dùng VISION_API cũ; khoá chung có nhưng thiếu baseUrl → vẫn rơi về cũ
      assert.deepEqual((await V.sharedAi(fakeDb({}))).providers.map(p=> p.label), ["VISION_API"]);
      assert.deepEqual((await V.sharedAi(fakeDb({ "ai_secret/main": { key: "NEWKEY-123456" }, "ai_config/main": { model: "x" } }))).providers.map(p=> p.label), ["VISION_API"]);
      // tất cả lỗi → unavailable + hoàn lượt
      let refunded = 0;
      await assert.rejects(()=> V.analyzeInbodyReportCore({ auth, data: { image: img } }, { key: "K", base: "https://api.x.com/v1", model: "m", rate: async ()=> 4, refund: async ()=>{ refunded++; }, fetch: async ()=> bad(500, "x") }), e=> e.code === "unavailable");
      assert.equal(refunded, 1);
      // thành công → không hoàn
      await V.analyzeFoodPhotoCore({ auth, data: { images: [img] } }, { key: "K", base: "https://api.x.com/v1", model: "m", rate: async ()=> 4, refund: async ()=>{ refunded++; }, fetch: async ()=> okJson(FOOD) });
      assert.equal(refunded, 1);
    });
  }
};

/* 21/11/2026 — functions/vision.js dùng chung cấu hình Trợ lý AI: ghép URL như aicoach, thử lại không response_format,
   thứ tự model dự phòng (visionModel → VISION_API cũ/Gemini → model → fallback), kết quả âm tính → thử model kế tiếp, hoàn lượt khi AI lỗi */
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
    t.test("VIS-03: thứ tự dự phòng visionModel → VISION_API cũ → model → fallback; 401 bỏ qua model còn lại; lỗi hết → hoàn lượt", async ()=>{
      const V = loadVision({ VISION_API_KEY: "OLDKEY-123456", VISION_API_BASE: "https://old.example/v1beta/openai/", VISION_MODEL: "gem" })._visionTest;
      const ai = await V.sharedAi(fakeDb({ "ai_config/main": { baseUrl: "https://new.example/v1", model: "chat-m", visionModel: "vis-m", fallback: "fb-m", dailyLimit: 7 }, "ai_secret/main": { key: "NEWKEY-123456" } }));
      assert.equal(ai.limit, 7);
      assert.deepEqual(ai.providers.map(p=> [p.base, p.models.join(",")]), [["https://new.example/v1", "vis-m"], ["https://old.example/v1beta/openai", "gem"], ["https://new.example/v1", "chat-m,fb-m"]]);
      const seen = [];
      const fetch = async (url, o)=>{ const b = JSON.parse(o.body); seen.push(b.model + "@" + new URL(url).host + (b.response_format ? "+rf" : ""));
        if(b.model === "vis-m") return bad(404, "model not found"); if(b.model === "gem") return bad(400, "bad rf");
        if(b.model === "chat-m") return bad(400, "image input not supported"); return okJson(FOOD); };
      const out = await V.runVision([img], "p", ai.providers, { fetch }, "t");
      assert.deepEqual(seen, ["vis-m@new.example+rf", "gem@old.example+rf", "gem@old.example", "chat-m@new.example+rf", "chat-m@new.example", "fb-m@new.example"]);
      assert.equal(out.model, "fb-m"); assert.equal(out.host, "new.example");
      // không đặt visionModel → Gemini cũ đứng đầu, rồi model → fallback
      const ai2 = await V.sharedAi(fakeDb({ "ai_config/main": { baseUrl: "https://new.example/v1", model: "chat-m", fallback: "fb-m" }, "ai_secret/main": { key: "NEWKEY-123456" } }));
      assert.deepEqual(ai2.providers.map(p=> p.label + ":" + p.models.join(",")), ["VISION_API:gem", "ai_config:chat-m,fb-m"]);
      // 401 ở khoá chung → bỏ cả visionModel lẫn model/fallback của khoá đó, chỉ còn VISION_API cũ
      const seen2 = [];
      await V.runVision([img], "p", ai.providers, { fetch: async (url, o)=>{ const b = JSON.parse(o.body); seen2.push(b.model); return b.model === "gem" ? okJson(FOOD) : bad(401, "bad key"); } }, "t");
      assert.deepEqual(seen2, ["vis-m", "gem"]);
      const seen3 = [];
      await V.runVision([img], "p", ai.providers, { fetch: async (url, o)=>{ const b = JSON.parse(o.body); seen3.push(b.model); return b.model === "fb-m" ? okJson(FOOD) : bad(b.model === "vis-m" ? 401 : 500, "x"); } }, "t").catch(()=>{});
      assert.deepEqual(seen3, ["vis-m", "gem"]);
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
    t.test("VIS-04: model 1 trả 200 {\"is_food\":false} (model chat không đọc ảnh) → rơi xuống model 2 trả món; thứ tự visionModel → Gemini → model → fallback", async ()=>{
      const V = loadVision({ VISION_API_KEY: "OLDKEY-123456", VISION_API_BASE: "https://old.example/v1beta/openai", VISION_MODEL: "gem" })._visionTest;
      const ai = await V.sharedAi(fakeDb({ "ai_config/main": { baseUrl: "https://new.example/v1", model: "chat-m", visionModel: "vis-m", fallback: "fb-m" }, "ai_secret/main": { key: "NEWKEY-123456" } }));
      const PHO = '{"is_food":true,"dish":"Phở bò","items":[{"name":"Bánh phở","grams":200},{"name":"Thịt bò","grams":60},{"name":"Nước dùng","grams":300}]}';
      const seen = [];
      const fetch = async (url, o)=>{ const b = JSON.parse(o.body); seen.push(b.model); return okJson(b.model === "vis-m" ? '{"is_food":false,"items":[]}' : PHO); };
      const r = await V.analyzeFoodPhotoCore({ auth, data: { images: [img] } }, { key: "NEWKEY-123456", base: "https://new.example/v1", models: ["vis-m"], legacy: { key: "OLDKEY-123456", base: "https://old.example/v1beta/openai", models: ["gem"] }, rate: async ()=> 5, fetch });
      assert.deepEqual(seen, ["vis-m", "gem"]); assert.equal(r.result.is_food, true); assert.equal(r.result.dish, "Phở bò"); assert.equal(r.result.items.length, 3);
      // is_food:true nhưng items rỗng cũng là âm tính; thứ tự đầy đủ khi chỉ model cuối đọc được
      const seen2 = [];
      const out = await V.runVision([img], "p", ai.providers, { fetch: async (url, o)=>{ const b = JSON.parse(o.body); seen2.push(b.model);
        return okJson(b.model === "fb-m" ? PHO : b.model === "gem" ? '{"is_food":true,"items":[]}' : '{"is_food":false}'); } }, "t", V.foodAccept(new Set()));
      assert.deepEqual(seen2, ["vis-m", "gem", "chat-m", "fb-m"]); assert.equal(out.model, "fb-m"); assert.equal(out.negative, false);
    });
    t.test("VIS-05: mọi model âm tính → trả kết quả âm tính (ưu tiên Gemini), không lỗi, không hoàn lượt; InBody không có số → thử tiếp", async ()=>{
      const V = loadVision()._visionTest;
      let refunded = 0; const seen = [];
      const fetch = async (url, o)=>{ const b = JSON.parse(o.body); seen.push(b.model); return okJson('{"is_food":false,"dish":"' + b.model + '","items":[]}'); };
      const r = await V.analyzeFoodPhotoCore({ auth, data: { images: [img] } }, { key: "K-12345678", base: "https://a.example/v1", models: ["m1", "m2"], legacy: { key: "G-12345678", base: "https://g.example/v1", models: ["gem"] }, rate: async ()=> 3, refund: async ()=>{ refunded++; }, fetch });
      assert.deepEqual(seen, ["m1", "m2", "gem"]); assert.equal(r.result.is_food, false); assert.equal(r.result.items.length, 0); assert.equal(r.result.dish, "gem"); assert.equal(refunded, 0);
      // âm tính + lỗi → vẫn trả âm tính (không báo "AI chưa đọc được")
      const r2 = await V.analyzeFoodPhotoCore({ auth, data: { images: [img] } }, { key: "K-12345678", base: "https://a.example/v1", models: ["m1", "m2"], rate: async ()=> 3,
        fetch: async (url, o)=> JSON.parse(o.body).model === "m1" ? okJson('{"is_food":false}') : bad(500, "x") });
      assert.equal(r2.result.is_food, false);
      // InBody: model 1 trả is_report true nhưng không có số → thử model 2
      const seenI = [];
      const ri = await V.analyzeInbodyReportCore({ auth, data: { image: img } }, { key: "K-12345678", base: "https://a.example/v1", models: ["m1", "m2"], rate: async ()=> 3,
        fetch: async (url, o)=>{ const m = JSON.parse(o.body).model; seenI.push(m); return okJson(m === "m1" ? '{"is_report":true,"weight":null}' : '{"is_report":true,"weight":70.2,"pbf":20}'); } });
      assert.deepEqual(seenI, ["m1", "m2"]); assert.equal(ri.result.is_report, true); assert.equal(ri.result.weight, 70.2);
      const ri2 = await V.analyzeInbodyReportCore({ auth, data: { image: img } }, { key: "K-12345678", base: "https://a.example/v1", models: ["m1"], rate: async ()=> 3, fetch: async ()=> okJson('{"is_report":false}') });
      assert.equal(ri2.result.is_report, false);
    });
    t.test("VIS-06: lời nhắc nói rõ có đồ ăn/đồ uống → is_food=true, có ví dụ phở/bún, bát canh/nước dùng vẫn là món", ()=>{
      const p = loadVision()._visionTest.buildPrompt("none", "", [], 1);
      assert.ok(/is_food = true/.test(p) && /phở/.test(p) && /bún/.test(p) && /bát canh/.test(p) && /nước dùng/.test(p));
      assert.ok(p.length < 4500, "lời nhắc không quá dài: " + p.length);
    });
  }
};

/* 19/11/2026 — Rà soát bảo mật (Cloudflare security-audit skill, run-1): test hồi quy cho các lỗi đã xác nhận C1–C15
   Báo cáo: outputs/security-audit/run-1/REPORT.md */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
class HttpsError extends Error { constructor(code, message){ super(message); this.code = code; } }
function loadFn(name, extra){
  const Module = require("module"), orig = Module._load;
  const mocks = Object.assign({ "firebase-functions/v2/https": { onCall: (o, h)=>{ const f = r=> h(r); f.opts = o; return f; }, HttpsError },
    "firebase-functions/params": { defineSecret: ()=> ({ value: ()=> "" }), defineString: (n, o)=> ({ value: ()=> (o && o.default) || "" }) },
    "firebase-functions/logger": { info(){}, warn(){}, error(){} }, "firebase-admin": { firestore: Object.assign(()=> ({}), { FieldValue: { increment: n=> n } }) },
    "./admin": { _adminTest: { actorOf: async r=> r._actor, hasPerm: (role, px, p)=> (px || []).includes(p), writeAudit: async ()=>{} } } }, extra || {});
  Module._load = function(req){ if(mocks[req]) return mocks[req]; return orig.apply(this, arguments); };
  const file = path.join(ROOT, "functions", name);
  try{ delete require.cache[require.resolve(file)]; return require(file); } finally { Module._load = orig; }
}
const okRes = body=> ({ ok: true, status: 200, json: async ()=> body, text: async ()=> JSON.stringify(body) });

module.exports = {
  name: "Rà soát bảo mật 19/11 — hồi quy C1–C15",
  area: "firestore.rules, functions/*, pt-connect.js, findpt.js, cloud-admin.js",
  async define(t){
    t.test("SEC-C13: khoá AI đã lưu KHÔNG được gửi tới URL gốc do người gọi đưa vào (models/test)", async ()=>{
      const T = loadFn("aicoach.js")._aiTest;
      const S = { cfg: { enabled: true, baseUrl: "https://api.example.vn/v1", model: "m" }, k: "sk-stored-12345678" };
      const store = { config: async ()=> T.cleanConfig(S.cfg, T.DEFAULTS), key: async ()=> S.k, save: async ()=>{}, rate: async ()=> 1, used: async ()=> 0, usage: async ()=>{}, usageDays: async ()=> [] };
      const editor = { uid: "e", role: "admin", px: ["settings.view", "settings.edit"] };
      const hits = []; const fetch = async (u, o)=>{ hits.push({ u, a: o.headers.Authorization }); return okRes({ data: [{ id: "m" }] }); };
      const audits = []; const dep = { store, fetch, audit: async (a, act, tg, d)=>{ audits.push({ act, d }); } };
      await assert.rejects(()=> T.adminAiConfigCore({ _actor: editor, data: { op: "models", baseUrl: "https://attacker.example/v1" } }, dep), e=> e.code === "failed-precondition");
      await assert.rejects(()=> T.adminAiConfigCore({ _actor: editor, data: { op: "test", model: "m", baseUrl: "https://attacker.example/v1" } }, dep), e=> e.code === "failed-precondition");
      assert.equal(hits.length, 0, "không có request nào ra ngoài");
      // URL đã lưu + khoá đã lưu vẫn chạy, có ghi nhật ký
      await T.adminAiConfigCore({ _actor: editor, data: { op: "models" } }, dep);
      assert.equal(hits[0].u, "https://api.example.vn/v1/models"); assert.ok(audits.some(x=> x.act === "settings.ai_probe"));
      // URL mới + khoá nhập tay → được thử
      await T.adminAiConfigCore({ _actor: editor, data: { op: "models", baseUrl: "https://other.vn/v1", apiKey: "sk-new-00000000" } }, dep);
      assert.equal(hits[1].a, "Bearer sk-new-00000000");
      // set đổi URL mà không nhập khoá → bị chặn
      await assert.rejects(()=> T.adminAiConfigCore({ _actor: editor, data: { op: "set", config: { baseUrl: "https://attacker.example/v1" } } }, dep), e=> e.code === "failed-precondition");
    });
    t.test("SEC-C14: tài khoản ẩn danh không dùng được AI trả phí (chat, ảnh món, InBody)", async ()=>{
      const T = loadFn("aicoach.js")._aiTest, V = loadFn("vision.js")._visionTest;
      const anon = { uid: "a1", token: { firebase: { sign_in_provider: "anonymous" } } };
      await assert.rejects(()=> T.aiChatCore({ auth: anon, data: { messages: [{ role: "user", content: "hi" }] } }, { store: {} }), e=> e.code === "permission-denied");
      const img = "data:image/jpeg;base64," + "A".repeat(200);
      await assert.rejects(()=> V.analyzeFoodPhotoCore({ auth: anon, data: { images: [img] } }, { key: "k", rate: async ()=> 5 }), e=> e.code === "permission-denied");
      await assert.rejects(()=> V.analyzeInbodyReportCore({ auth: anon, data: { image: img } }, { key: "k", rate: async ()=> 5 }), e=> e.code === "permission-denied");
    });
    t.test("SEC-C9: hoà điểm thử thách → vị trí duy nhất (ai đạt sớm hơn đứng trước), quà/thưởng hạng theo pos", ()=>{
      const src = read("functions/commerce.js");
      assert.ok(/r\.pos <= top/.test(src) && /RANK_BONUS\[r\.pos - 1\]/.test(src));
      const m = src.match(/function rankEntries\(list\)\{[\s\S]*?\n\}/)[0];
      const rankEntries = new Function("arr", "str", m + "; return rankEntries;")(a=> Array.isArray(a) ? a : [], (v, n)=> String(v || "").slice(0, n));
      const rows = rankEntries([{ uid: "c", value: 100, serverAt: 30 }, { uid: "a", value: 100, serverAt: 10 }, { uid: "b", value: 100, serverAt: 20 }, { uid: "d", value: 50, serverAt: 1 }]);
      assert.deepEqual(rows.map(r=> r.uid), ["a", "b", "c", "d"]); assert.deepEqual(rows.map(r=> r.pos), [1, 2, 3, 4]); assert.deepEqual(rows.map(r=> r.rank), [1, 1, 1, 4]);
    });
    t.test("SEC-C10/C11: giữ mã không tự gia hạn; giới hạn đơn chưa xác nhận đang mở", ()=>{
      const src = read("functions/commerce.js");
      assert.ok(/if\(!mine\) tx\.set\(holdRef/.test(src)); assert.ok(/MAX_OPEN_ORDERS/.test(src) && /"pending", "awaiting_payment"/.test(src));
    });
    t.test("SEC-C4: lời mời — rules khoá clientId/email khi PT sửa; joinByCode kiểm lời mời do đúng PT của form gửi", ()=>{
      const r = read("firestore.rules"), s = read("functions/social.js");
      assert.ok(/request\.resource\.data\.clientId == resource\.data\.clientId && request\.resource\.data\.email == resource\.data\.email/.test(r));
      assert.ok(/via === "invite" && invPtId !== c\.ptId/.test(s)); assert.ok(/\^\[A-Za-z0-9_-\]\{1,128\}\$/.test(s));
    });
    t.test("SEC-C1/C2/C3/C5/C8: rules Tìm PT + khoảnh khắc sự kiện", ()=>{
      const r = read("firestore.rules");
      assert.ok(/function noFakeStats/.test(r) && /noFakeStats\(request\.resource\.data\) && !adminHidden\(\)/.test(r), "C1/C2 create");
      assert.ok(/allow delete: if isOwner\(\) && resource\.data\.get\('hidden', false\) != true;/.test(r), "C2 delete");
      assert.ok(/request\.resource\.data\.kind == 'review' && request\.resource\.data\.uid == rid   \/\/ audit C5/.test(r), "C5");
      assert.ok(/request\.resource\.data\.createdAt > request\.time\.toMillis\(\) - 300000/.test(r) && /resource\.data\.get\('respondedAt', 0\) == 0 && request\.resource\.data\.respondedAt is int/.test(r), "C8");
      const f = read("findpt.js"); assert.ok(!/l\.statsVerified \|\| s\.verified/.test(f) && /verified: !!l\.statsVerified/.test(f), "C1 hiển thị");
      assert.ok(/collection\("ptListings"\)\.doc\(uid\)/.test(read("cloud-admin.js")), "C3: ẩn ở Quản trị ghi cả ptListings.hidden");
    });
    t.test("SEC-C7/C12: dọn dữ liệu khi xoá tài khoản không trừ bộ đếm của người khác, không xoá lời mời theo email chưa xác minh", ()=>{
      const s = read("functions/index.js");
      assert.ok(/new Set\(/.test(s) && /if\(!sn \|\| !sn\.exists\) return;/.test(s), "C7");
      assert.ok(/email && emailVerified === true/.test(s) && /user\.emailVerified === true/.test(s), "C12");
    });
    t.test("SEC-C15: pt-connect — số từ dữ liệu người khác luôn ép kiểu trước khi vào HTML", ()=>{
      const s = read("pt-connect.js");
      for(const bad of ["${m.streak != null ? m.streak", "${m.s30 != null ? m.s30", "${w.n}${w.tot", "${w.dur} phút", "×${x[1]}`", "${kgS(x.kg)}×${x.reps}"]) assert.ok(!s.includes(bad), "còn chèn thô: " + bad);
      const nS = new Function(s.match(/const nS = [^\n]+/)[0] + "; return nS;")();
      assert.equal(nS("<img src=x onerror=alert(1)>"), "—"); assert.equal(nS(12), "12"); assert.equal(nS("8"), "8");
    });
  }
};

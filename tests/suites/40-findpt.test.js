/* TapEasy — Tìm PT (cloud-pt-directory.js + findpt.js), động cơ DEMO
   Chạy riêng: node tests/run.js --only findpt
   Nạp app thật (index.html) + module vòng 2 ngay sau pt-pro.js (đúng thứ tự trong docs/INTEGRATION-findpt.md). */
"use strict";
const { assert, expectNone } = require("../lib/framework");
const { scriptOrder } = require("../lib/harness");
const fs = require("fs"), path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const MODS = ["cloud-social.js", "pt-connect.js", "community.js", "cloud-pt-directory.js", "findpt.js"].filter(f=> fs.existsSync(path.join(ROOT, f)));
function order(){
  const base = scriptOrder().filter(f=> !MODS.includes(f));
  let i = base.indexOf("pt-pro.js"); if(i < 0) i = base.indexOf("pt.js");
  return base.slice(0, i+1).concat(MODS, base.slice(i+1));
}

module.exports = {
  name: "TapEasy Tìm PT — album, bộ lọc, đánh giá (demo)",
  area: "Tìm PT (cloud-pt-directory.js · findpt.js)",
  async define(t){
    const app = await t.app({ scripts: order(), settleMs: 150 });
    const run = code=> app.ev(`(async()=>{ ${code} })()`);
    const J = async code=>{ const v = await run(code); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
    const errOf = async code=>{ try{ await run(code); return null; }catch(e){ return { message: e.message, code: e.code }; } };

    t.test("Module nạp không lỗi, engine demo, 20 PT minh hoạ đa dạng, ≥ 60 đánh giá", async ()=>{
      assert.deepEqual(app.loadErrors.map(e=> e.file), []);
      assert.equal(app.ev("cloud.ptdir.engine"), "demo");
      assert.equal(app.ev("TE_FINDPT.installed"), true);
      const s = await J(`const l = await cloud.ptdir.list(); let rv = 0; for(const x of l) rv += (await cloud.ptdir.reviews(x.id)).length;
        return { n:l.length, rv, m:l.filter(x=> x.gender==="male").length, f:l.filter(x=> x.gender==="female").length, prov:new Set(l.map(x=> x.prov)).size,
          lo:Math.min(...l.map(x=> x.prices.single)), hi:Math.max(...l.map(x=> x.prices.single)), bad:l.map(x=> [x.id, cloud.ptdir.logic.validateListing(x)]).filter(x=> x[1]) }`);
      assert.equal(s.n, 20); assert.ok(s.rv >= 60, "số đánh giá " + s.rv);
      assert.ok(s.m >= 8 && s.f >= 8, `nam ${s.m} / nữ ${s.f}`);
      assert.ok(s.prov >= 10, "số tỉnh " + s.prov);
      assert.ok(s.lo >= 150000 && s.lo <= 160000 && s.hi === 1200000, `giá ${s.lo}–${s.hi}`);
      assert.deepEqual(s.bad, []);
      assert.equal(app.ev("cloud.ptdir.data.PROVINCES.length"), 34, "34 tỉnh/thành mới");
    });

    t.test("Ảnh: chỉ images.pexels.com, mỗi ảnh có tác giả; album 3–9 ảnh; không trùng ảnh giữa các PT", async ()=>{
      const s = await J(`const l = await cloud.ptdir.list(); const used = {}, bad = [];
        l.forEach(x=>{ if(x.album.length < 3 || x.album.length > 9) bad.push(x.id + " album " + x.album.length);
          [{ src:x.cover, by:x.coverCredit.by }].concat(x.album).forEach(a=>{ if(!/^https:\\/\\/images\\.pexels\\.com\\/photos\\/\\d+\\//.test(a.src)) bad.push(x.id + " url"); if(!a.by) bad.push(x.id + " credit");
            const id = a.src.match(/photos\\/(\\d+)/)[1]; (used[id] = used[id] || new Set()).add(x.id); }); });
        return { bad, dup: Object.entries(used).filter(([k, v])=> v.size > 1).map(([k])=> k) }`);
      expectNone(s.bad, "ảnh không hợp lệ"); expectNone(s.dup, "ảnh dùng cho nhiều PT");
    });

    t.test("Logic: tìm không dấu, lọc khu vực/địa điểm/giá/giới tính/chuyên môn/sao/xác minh, sắp xếp", async ()=>{
      const r = await J(`const L = cloud.ptdir.logic, l = await cloud.ptdir.list(); const ids = f=> L.filterListings(l, f).map(x=> x.id);
        return { q1: ids({ q:"cau giay" }), q2: ids({ q:"YOGA nữ" }).length, hn: ids({ prov:"hn" }).length, ward: ids({ prov:"hcm", ward:"Phường Sài Gòn" }),
          online: ids({ place:"online", priceMax:200000 }).length, gym: ids({ gym:"lumi" }), fem: ids({ gender:"female" }).length,
          spec: ids({ specs:["Boxing","Muay Thai"] }).length, r48: ids({ minRating:4.8 }).every(id=> l.find(x=> x.id===id).ratingAvg >= 4.8),
          ver: ids({ verified:true }).length === l.filter(x=> x.verified).length,
          cheap: L.sortListings(l, "price_asc")[0].priceFrom === Math.min(...l.map(x=> x.priceFrom)),
          cnt: L.countFilters({ prov:"hn", priceMax:500000, specs:["Yoga"], verified:true }) }`);
      assert.deepEqual(r.q1, ["seed_khang"]); assert.equal(r.q2, 3); assert.equal(r.hn, 3); assert.deepEqual(r.ward, ["seed_phuc"]);
      assert.equal(r.online, 5); assert.deepEqual(r.gym, ["seed_ngocanh"]); assert.equal(r.fem, 10); assert.equal(r.spec, 2);
      assert.ok(r.r48 && r.ver && r.cheap); assert.equal(r.cnt, 4);
    });

    t.test("Minh bạch: điểm = trung bình đánh giá đang hiện, đánh giá ẩn được đếm riêng; 'Phù hợp' không có điểm trả tiền", async ()=>{
      const r = await J(`const L = cloud.ptdir.logic; const rv = await cloud.ptdir.reviews("seed_nhatnam"); const g = L.aggregate(rv);
        const vis = rv.filter(x=> !x.hidden); const l = await cloud.ptdir.get("seed_khang");
        return { avg:g.avg, exp: Math.round(vis.reduce((a,x)=> a + x.stars, 0) / vis.length * 10) / 10, hid:g.hiddenCount, cnt:g.count, parts: L.matchScore(l, {}).parts.map(p=> p[0]),
          mask: [L.maskName("Hoàng Long"), L.maskName("Trần Thị Thu Hà"), L.maskName("Sarah K."), L.maskName("Jenny Park")] }`);
      assert.equal(r.avg, r.exp); assert.equal(r.hid, 1); assert.equal(r.cnt, 3);
      assert.ok(!r.parts.some(p=> /quảng cáo|trả tiền|tài trợ|sponsor/i.test(p)), r.parts.join(" | "));
      assert.deepEqual(r.mask, ["Long H.", "Hà T.", "Sarah K.", "Jenny P."]);
    });

    t.test("Đánh giá: chỉ người 'đã tập cùng'; buổi thử → PT xác nhận → đánh giá; kiểm tra nội dung", async ()=>{
      assert.equal((await J(`return await cloud.ptdir.eligibility("seed_thuha")`)).code, "login");
      await run(`await cloud.signUp("hv@mail.vn", "matkhau1", "Phạm Minh Hoà");`);
      const e0 = await J(`return await cloud.ptdir.eligibility("seed_thuha")`);
      assert.equal(e0.ok, false); assert.equal(e0.code, "not-trained");
      assert.equal((await errOf(`await cloud.ptdir.submitReview("seed_thuha", { stars:5, criteria:{ expertise:5, punctual:5, attitude:5, results:5 }, text:"Rất tuyệt vời, chị dạy rất có tâm và kỹ." })`)).code, "ptdir/not-eligible");
      const q = await J(`return await cloud.ptdir.sendRequest("seed_thuha", { kind:"trial", slot:{ date:"2026-12-02", time:"07:00" }, goal:"Đỡ đau vai gáy" })`);
      assert.equal(q.status, "pending");
      assert.equal((await errOf(`await cloud.ptdir.sendRequest("seed_thuha", { kind:"trial", slot:{ date:"2026-12-03", time:"07:00" } })`)).code, "ptdir/dup");
      assert.equal((await errOf(`await cloud.ptdir.sendRequest("seed_thuha", { kind:"question", text:"Số em 0912345678 ạ" })`)).code, "ptdir/pii");
      await run(`await cloud.ptdir.simulateTrialDone("seed_thuha", ${JSON.stringify(q.id)})`);
      const e1 = await J(`return await cloud.ptdir.eligibility("seed_thuha")`);
      assert.equal(e1.ok, true); assert.equal(e1.basis.type, "trial");
      assert.match((await errOf(`await cloud.ptdir.submitReview("seed_thuha", { stars:5, criteria:{ expertise:5, punctual:5, attitude:5, results:5 }, text:"ngắn quá" })`)).message, /ít nhất 20/);
      assert.match((await errOf(`await cloud.ptdir.submitReview("seed_thuha", { stars:4, criteria:{ expertise:4, punctual:4, attitude:4, results:4 }, text:"Gọi mình 0987 654 321 nếu cần hỏi thêm nhé mọi người" })`)).message, /số điện thoại/);
      const r = await J(`return await cloud.ptdir.submitReview("seed_thuha", { stars:4, criteria:{ expertise:5, punctual:4, attitude:5, results:3 }, text:"Buổi thử nhẹ nhàng, chị chỉnh tư thế kỹ, giải thích vì sao đau vai gáy." })`);
      assert.equal(r.basis.type, "trial"); assert.equal(r.reply, null); assert.equal(r.hidden, false);
      const r2 = await J(`return await cloud.ptdir.submitReview("seed_thuha", { stars:5, criteria:{ expertise:5, punctual:5, attitude:5, results:4 }, text:"Cập nhật: tập thêm 2 buổi online, đỡ hẳn đau vai gáy." })`);
      assert.ok(r2.editedAt, "sửa đánh giá → có editedAt"); assert.equal(r2.createdAt, r.createdAt);
      const n = await J(`return (await cloud.ptdir.reviews("seed_thuha")).filter(x=> x.uid === cloud.user.uid).length`);
      assert.equal(n, 1, "1 đánh giá / người / PT");
    });

    t.test("PT không xoá / không ẩn được đánh giá; kiểm duyệt cần teCan('reviews.moderate'); báo cáo 1 lần / người", async ()=>{
      const ruid = await run(`return (await cloud.ptdir.reviews("seed_thuha")).find(x=> x.uid !== cloud.user.uid).uid`);
      const a = await J(`return await cloud.ptdir.reportReview("seed_thuha", ${JSON.stringify(ruid)}, "Thông tin sai sự thật")`);
      const b = await J(`return await cloud.ptdir.reportReview("seed_thuha", ${JSON.stringify(ruid)}, "Thông tin sai sự thật")`);
      assert.equal(a.reports, 1); assert.equal(b.already, true);
      assert.equal(await run(`return (await cloud.ptdir.reviews("seed_thuha")).find(x=> x.uid === ${JSON.stringify(ruid)}).hidden`), false, "báo cáo không tự ẩn");
      assert.equal((await errOf(`await cloud.ptdir.moderateReview("seed_thuha", ${JSON.stringify(ruid)}, "hide", "Xúc phạm")`)).code, "ptdir/denied");
      assert.equal((await errOf(`await cloud.ptdir.replyReview("seed_thuha", ${JSON.stringify(ruid)}, "Cảm ơn")`)).code, "ptdir/denied", "không phải PT chủ hồ sơ");
      assert.equal(app.ev("typeof cloud.ptdir.deleteReview"), "undefined");
      // có rbac.js → giả lập quyền qua TE_RBAC.can (teCan của RBAC không cho gán đè); không có → gán teCan
      await run(`window.__teCanOld = window.teCan; if(window.TE_RBAC){ TE_RBAC.__fpOrig = TE_RBAC.can; TE_RBAC.can = p=> p === "reviews.moderate"; } else window.teCan = p=> p === "reviews.moderate";`);
      try{
        assert.equal((await errOf(`await cloud.ptdir.moderateReview("seed_thuha", ${JSON.stringify(ruid)}, "hide", "")`)).code, "ptdir/reason");
        const h = await J(`return await cloud.ptdir.moderateReview("seed_thuha", ${JSON.stringify(ruid)}, "hide", "Không phải trải nghiệm thật")`);
        assert.equal(h.hidden, true); assert.equal(h.hiddenReason, "Không phải trải nghiệm thật");
        const g = await J(`return cloud.ptdir.logic.aggregate(await cloud.ptdir.reviews("seed_thuha"))`);
        assert.equal(g.hiddenCount, 1);
        await run(`await cloud.ptdir.moderateReview("seed_thuha", ${JSON.stringify(ruid)}, "restore")`);
      } finally { await run(`if(window.TE_RBAC && TE_RBAC.__fpOrig){ TE_RBAC.can = TE_RBAC.__fpOrig; delete TE_RBAC.__fpOrig; } else window.teCan = window.__teCanOld;`); }
    });

    t.test("PT niêm yết: cần Chế độ PT, kiểm tra dữ liệu, nháp được thiếu, xác minh chỉ do pt.verify", async ()=>{
      await run(`await cloud.signOut(); await cloud.signUp("pt.lan@tapeasy.vn", "matkhau1", "Võ Ngọc Lan");`);
      assert.equal((await errOf(`await cloud.ptdir.saveMyListing({ name:"Lan" })`)).code, "ptdir/not-pt");
      await run(`await cloud.updateMyProfile({ isPT:true })`);
      assert.equal((await errOf(`await cloud.ptdir.saveMyListing({ name:"Võ Ngọc Lan", gender:"female" })`)).code, "ptdir/invalid");
      const d = await J(`return await cloud.ptdir.saveMyListing({ name:"Võ Ngọc Lan" }, { draft:true })`);
      assert.equal(d.status, "draft");
      const img = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
      const l = await J(`return await cloud.ptdir.saveMyListing({ name:"Võ Ngọc Lan", gender:"female", specs:["Yoga"], prov:"dn", ward:"Phường Hải Châu", places:[{ type:"online", name:"Zoom" }],
        prices:{ single:300000, pack12:3300000, pack24:0, online:200000, trial:0 }, cancel:"flex", cover:${JSON.stringify(img)}, album:[{src:${JSON.stringify(img)}},{src:${JSON.stringify(img)}},{src:${JSON.stringify(img)}}],
        verified:true, ratingAvg:5, ratingCount:999 })`);
      assert.equal(l.status, "public"); assert.equal(l.verified, false, "PT không tự gắn xác minh"); assert.equal(l.ratingCount, 0, "PT không tự đặt điểm");
      assert.ok(l.priceUpdatedAt > 0);
      assert.equal((await errOf(`await cloud.ptdir.setVerified(cloud.user.uid, true, "x")`)).code, "ptdir/denied");
      const listed = await J(`return (await cloud.ptdir.list()).some(x=> x.id === cloud.user.uid)`);
      assert.equal(listed, true);
    });

    t.test("Nhận xét học viên RIÊNG TƯ: chỉ PT của form viết; học viên phản hồi, tự bật chia sẻ tóm tắt (không kèm lời)", async ()=>{
      const c = await J(`return await cloud.createClient({ name:"Hoà", goal:"Giảm mỡ" })`);
      await run(`await cloud.ptdir.saveFeedback(${JSON.stringify(c.id)}, { stars:{ attendance:5, effort:4, comms:3 }, text:"Đi tập đều, cần trao đổi chủ động hơn khi mệt." })`);
      await run(`await cloud.signOut(); await cloud.signIn("hv@mail.vn", "matkhau1"); await cloud.joinByCode(${JSON.stringify(c.joinCode)});`);
      assert.equal((await errOf(`await cloud.ptdir.saveFeedback(${JSON.stringify(c.id)}, { stars:{ attendance:5, effort:5, comms:5 }, text:"Tự khen mình nè hihi" })`)).code, "ptdir/denied");
      assert.equal(await J(`return await cloud.ptdir.myStudentCard()`), null, "chưa bật chia sẻ → không có thẻ");
      await run(`await cloud.ptdir.replyFeedback(${JSON.stringify(c.id)}, "Em sẽ báo khi mệt ạ"); await cloud.ptdir.setFeedbackShareable(${JSON.stringify(c.id)}, true);`);
      const card = await J(`return await cloud.ptdir.myStudentCard()`);
      assert.deepEqual(card, { n:1, attendance:5, effort:4, comms:3 });
    });

    t.test("Giao diện: album, thẻ thoát HTML, hồ sơ mở rộng, điểm vào", async ()=>{
      const html = await run(`const l = Object.assign({}, await cloud.ptdir.get("seed_khang"), { id:"x\\"><img src=x onerror=1>", name:"<img src=x onerror=alert(1)> Khang" }); return TE_FINDPT.cardHTML(l, "hero", 0, 0);`);
      assert.ok(!/<img src=x/.test(html), "tên PT phải được escape");
      assert.ok(html.includes("&lt;img"));
      // DOM giả của harness không phân tích HTML → kiểm tra chuỗi HTML đã render (luồng chạm thật: _test/findpt-flow.html, 97 bước)
      const r = await J(`goto("findpt"); await new Promise(r=> setTimeout(r, 300)); const a = document.querySelector("#fp-album"), h = a ? a.innerHTML : "";
        return { active: document.querySelector("#screen-findpt").classList.contains("active"), cards: (h.match(/data-fp-open="seed_/g) || []).length, note: h.includes("fp-note-price"),
          rows: ["fp-r-hero","fp-r-pairA","fp-r-wide","fp-r-pairB"].every(c=> h.includes(c)), giant: h.includes("fp-giant"),
          sub: (typeof SUB_SCREENS !== "undefined") && SUB_SCREENS.includes("findpt"), soon: typeof openFindPTSoon === "function" ? String(openFindPTSoon).includes("FP.open") : null,
          explore: !!(window.teHomeExplore && teHomeExplore.has("findpt")) }`);
      assert.equal(r.active, true); assert.equal(r.cards, 20, "số thẻ " + r.cards); assert.equal(r.note, true); assert.equal(r.rows, true); assert.equal(r.giant, true);
      assert.deepEqual([r.sub, r.soon, r.explore], [true, true, true], JSON.stringify(r));
      const p = await J(`await TE_FINDPT.openListing("seed_anhdung", { from:"findpt" }); await new Promise(r=> setTimeout(r, 300)); const h = document.querySelector("#pp-content").innerHTML;
        return { active: document.querySelector("#screen-ptprofile").classList.contains("active"), ext: h.includes('id="fp-x"'), price: /1\.200\.000đ/.test(h) && /800\.000đ/.test(h) && /24\.000\.000đ/.test(h),
          secs: ["fp-sec-album","fp-sec-price","fp-sec-place","fp-sec-avail","fp-sec-cert","fp-sec-open","fp-sec-rv"].every(id=> h.includes('id="' + id + '"')),
          dock: ["msg","trial","connect"].every(k=> h.includes('data-fpx="' + k + '"')), cancel: h.includes("Chính sách huỷ") }`);
      assert.deepEqual(p, { active:true, ext:true, price:true, secs:true, dock:true, cancel:true });
    });
  },
};

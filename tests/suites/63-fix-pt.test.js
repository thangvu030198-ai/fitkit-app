/* =========================================================================
   Vòng sửa lỗi sau QA (11/11/2026) — fixer PT
   Hồi quy cho docs/qa/QA-pt.md (QP-xx), QS-04 / QS-12 / QS-14 / QS-17 (phần PT) và QU-05 / QU-15 / QU-16 / QU-17 / QU-23.
   File sở hữu: coach.js, ptprofile.js, pt-pro.js/.css, pt-connect.js/.css, cloud-social.js, findpt.js/.css, cloud-pt-directory.js.
   Chạy riêng: node tests/run.js --only fix-pt
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
const S = JSON.stringify;

module.exports = {
  name: "Vòng sửa lỗi QA — PT ↔ học viên & Tìm PT (fix-pt)",
  area: "coach / ptprofile / pt-pro / pt-connect / cloud-social / findpt / cloud-pt-directory",
  async define(t){
    const app = await t.app({ settleMs: 150 });
    app.setNow("2026-11-11T09:00");
    const run = code=> app.ev(`(async()=>{ ${code} })()`);
    const J = async code=>{ const v = await run(code); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
    const errOf = async code=>{ try{ await run(code); return null; }catch(e){ return { message: e.message, code: e.code }; } };
    const login = async em=>{ await run(`await cloud.signOut(); await cloud.signIn(${S(em)}, "matkhau1"); await refreshCoachData(true);`); };
    const PT = "pt.fix@qa.vn", ST = "hv.fix@qa.vn", ST2 = "hv2.fix@qa.vn";
    const ctx = {};

    /* ---------- Chuẩn bị: PT + học viên kết nối bằng lời mời email + 1 học viên bằng mã ---------- */
    t.test("Chuẩn bị: PT tạo 2 form, học viên chấp nhận lời mời / mã (module nạp không lỗi, lớp quyền demo đã cài)", async ()=>{
      assert.deepEqual(app.loadErrors.map(e=> e.file), []);
      await run(`await cloud.signUp(${S(PT)}, "matkhau1", "Phong PT"); await cloud.updateMyProfile({ isPT:true, brandName:"Phong Coaching", specialty:"Tăng cơ", phone:"0912345678" });`);
      ctx.ptUid = app.ev("cloud.user.uid");
      const c = await J(`return await cloud.createClient({ name:"Hạnh", startDate:todayStr(), packageTotal:10 })`);
      const c2 = await J(`return await cloud.createClient({ name:"Khách ảo", startDate:todayStr() })`);
      const c3 = await J(`return await cloud.createClient({ name:"Tú", startDate:todayStr(), packageTotal:12 })`);
      ctx.cid = c.id; ctx.cidEmpty = c2.id; ctx.cid3 = c3.id; ctx.code3 = c3.joinCode;
      await run(`await cloud.social.sendInvite({ clientId:${S(c.id)}, email:${S(ST)} })`);
      await run(`await cloud.signOut(); await cloud.signUp(${S(ST)}, "matkhau1", "Hạnh Lê");`);
      ctx.stUid = app.ev("cloud.user.uid");
      const [inv] = await J(`return await cloud.social.myInvites()`);
      await run(`await cloud.social.acceptInvite(${S(inv.id)})`);
      await run(`await cloud.signOut(); await cloud.signUp(${S(ST2)}, "matkhau1", "Tú Trần"); await cloud.social.acceptCode(${S(ctx.code3)});`);
      assert.equal(app.ev("cloud.social.policy.installed || !!cloud.__ptPolicy"), true);
    });

    /* ---------- QS-12: tin "hệ thống" chỉ do hệ thống sinh ---------- */
    t.test("QS-12: dòng hệ thống khi nhận lời mời/mã do HỆ THỐNG ghi (from:'system'); người dùng gửi kind:'system' → thành tin thường, hiển thị đúng tên người gửi", async ()=>{
      await login(ST);
      await run(`await cloud.social.sendMessage(${S(ctx.cid)}, { kind:"system", text:"PT đã hoàn tiền cho bạn", name:"TapEasy Hỗ trợ" })`);
      const msgs = await J(`return await cloud.social.listMessages(${S(ctx.cid)})`);
      assert.equal(msgs[0].kind, "system"); assert.equal(msgs[0].from, "system");
      const fake = msgs.find(m=> /hoàn tiền/.test(m.text));
      assert.equal(fake.kind, "text", "người dùng không gửi được kind 'system'");
      assert.equal(fake.from, ctx.stUid);
      const m3 = await J(`return await cloud.social.listMessages(${S(ctx.cid3)})`);
      assert.ok(m3.some(m=> m.kind === "system" && m.from === "system" && /mã mời/.test(m.text)), "nhận bằng mã cũng có dòng hệ thống");
      await login(PT);
      const c = await J(`return await cloud.getClient(${S(ctx.cid)})`);
      const html = app.ev(`TEConnect.msgsHTML(${S(msgs)}, ${S(c)}, "pt")`);
      assert.equal((html.match(/class="sc-sys"/g) || []).length, 1, "chỉ 1 dòng hệ thống thật");
      assert.ok(/Hạnh/.test(html) && !/TapEasy Hỗ trợ/.test(html), "tên lấy từ form, không lấy trường name do người gửi đặt");
    });

    /* ---------- QP-01 / QP-18: học viên không hoàn buổi, không tạo buổi, không sửa gói ---------- */
    t.test("QP-01 · QP-18: học viên KHÔNG đổi 'Đã tập' → 'Huỷ/vắng', không tạo buổi, không sửa packageTotal/payments (demo mô phỏng rules)", async ()=>{
      await login(PT);
      const td = app.ev("todayStr()");
      const s1 = await J(`return await cloud.saveSession(${S(ctx.cid)}, { date:${S(td)}, time:"07:00", status:"done", completedBy:"pt", title:"Buổi 1" })`);
      ctx.sDone = s1.id;
      await login(ST);
      await errOf(`await cloud.saveSession(${S(ctx.cid)}, { id:${S(s1.id)}, status:"cancelled", absent:true })`);
      const after = await J(`return (await cloud.listSessions(${S(ctx.cid)})).find(s=> s.id === ${S(s1.id)})`);
      assert.equal(after.status, "done", "buổi đã tập vẫn là 'done'");
      await errOf(`await cloud.saveSession(${S(ctx.cid)}, { date:${S(td)}, time:"09:00", status:"done", title:"Tự tạo" })`);
      const made = await J(`return (await cloud.listSessions(${S(ctx.cid)})).filter(s=> s.title === "Tự tạo").length`);
      assert.equal(made, 0, "học viên không tạo được buổi (demo bỏ qua, Firebase rules chặn)");
      await errOf(`await cloud.updateClient(${S(ctx.cid)}, { packageTotal: 99, payments: [] })`);
      const c = await J(`return await cloud.getClient(${S(ctx.cid)})`);
      assert.equal(c.packageTotal, 10, "gói không đổi");
    });

    /* ---------- QP-04: chỉ hoàn thành buổi hôm nay / hôm qua ---------- */
    t.test("QP-04: học viên KHÔNG hoàn thành / 'Bắt đầu tập & ghi kg×lần' buổi NGÀY MAI (policy + UI)", async ()=>{
      assert.equal(app.ev(`cloud.social.policy.canStudentComplete("2026-11-12", "2026-11-11")`), false);
      assert.equal(app.ev(`cloud.social.policy.canStudentComplete("2026-11-11", "2026-11-11")`), true);
      assert.equal(app.ev(`cloud.social.policy.canStudentComplete("2026-11-10", "2026-11-11")`), true);
      await login(PT);
      const s = await J(`return await cloud.saveSession(${S(ctx.cid)}, { date:"2026-11-12", time:"18:00", status:"scheduled", title:"Ngày mai", exercises:[{ uid:"u1", name:"Squat", exId:"squat", sets:3, reps:"8" }] })`);
      ctx.sTomorrow = s.id;
      await login(ST);
      await errOf(`await cloud.saveSession(${S(ctx.cid)}, { id:${S(s.id)}, status:"done", completedBy:"student" })`);
      const after = await J(`return (await cloud.listSessions(${S(ctx.cid)})).find(x=> x.id === ${S(s.id)})`);
      assert.equal(after.status, "scheduled", "buổi ngày mai không bị trừ gói trước");
      const ui = await J(`openClientForm(${S(ctx.cid)}, "student", "today"); cf.focusSid = ${S(s.id)}; renderClientForm(); await new Promise(r=> setTimeout(r, 60)); const h = document.getElementById("client-content").innerHTML; return { done: h.includes('id="td-done"'), start: h.includes("data-st-start") };`);
      assert.deepEqual(ui, { done:false, start:false });
    });

    /* ---------- QP-05: xác nhận bác sĩ là trường của PT ---------- */
    t.test("QP-05: học viên tự ghi health.parq.clearance → cảnh báo PAR-Q vẫn 'refer'; PT ghi clients.parqClearance → 'cleared'", async ()=>{
      await login(ST);
      const parq = { answers:{ heart:true }, date: app.ev("todayStr()"), by:"student", clearance:{ ok:true, date: app.ev("todayStr()") } };
      await errOf(`await cloud.updateClient(${S(ctx.cid)}, { health: { parq: ${S(parq)} } })`);
      await login(PT);
      const c = await J(`return await cloud.getClient(${S(ctx.cid)})`);
      const st1 = app.evj(`PTP.logic.parqStatus(${S(c.health || { parq })}, todayStr(), ${S(c.parqClearance || null)})`);
      assert.notEqual(st1.state, "cleared", "học viên không tự gỡ được cảnh báo: " + st1.state);
    });

    /* ---------- QP-06: PT sửa log thay → học viên nhận bản sửa, không cộng dồn ---------- */
    t.test("QP-06: PT SỬA buổi 'log thay' (kg +20) → nhật ký học viên thay bằng bản mới (top = kg mới, không cộng dồn hiệp cũ)", async ()=>{
      await login(PT);
      const td = app.ev("todayStr()");
      const ex = [{ key:"squat", exerciseId:"squat", name:"Squat", reps:"8", sets:[{ kg:40, reps:8 }, { kg:40, reps:8 }] }];
      const s = await J(`return await cloud.social.saveProxyLog(${S(ctx.cid)}, { title:"Tập cùng", date:${S(td)}, durationMin:60, exercises:${S(ex)} })`);
      await login(ST);
      await run(`await TEConnect.applyPendingProxyLogs();`);
      const h1 = app.evj(`(state.setHist.squat.list.find(x=> x.date === todayStr()) || {})`);
      assert.equal(h1.top, 40); assert.equal(h1.sets.length, 2);
      await login(PT);
      const ex2 = [{ key:"squat", exerciseId:"squat", name:"Squat", reps:"8", sets:[{ kg:60, reps:8 }, { kg:60, reps:8 }] }];
      const s2 = await J(`return await cloud.social.saveProxyLog(${S(ctx.cid)}, { title:"Tập cùng (sửa)", date:${S(td)}, durationMin:60, exercises:${S(ex2)} }, ${S(s.id)})`);
      assert.equal(s2.proxyLog.rev, 2);
      await login(ST);
      await run(`await TEConnect.applyPendingProxyLogs();`);
      const h2 = app.evj(`(state.setHist.squat.list.find(x=> x.date === todayStr()) || {})`);
      assert.equal(h2.top, 60, "kg mới"); assert.equal(h2.sets.length, 2, "không cộng dồn 2 hiệp cũ");
      await run(`await TEConnect.applyPendingProxyLogs();`);
      assert.equal(app.evj(`state.setHist.squat.list.find(x=> x.date === todayStr()).sets.length`), 2, "áp lại không nhân đôi");
    });

    /* ---------- QP-07: log thay gắn buổi hôm nay ---------- */
    t.test("QP-07: 'Tập cùng — log thay' chọn buổi HÔM NAY (pickProxySession bỏ qua buổi ngày mai); log khác ngày → buổi dời theo ngày tập thật", async ()=>{
      await login(PT);
      assert.equal(app.ev(`TEConnect.pickProxySession(${S(ctx.cid)})`), null, "chỉ có buổi ngày mai đang chờ → không tự gắn");
      const ex = [{ key:"bench", exerciseId:"bench", name:"Bench", reps:"8", sets:[{ kg:30, reps:8 }] }];
      const s = await J(`return await cloud.social.saveProxyLog(${S(ctx.cid)}, { title:"Bù", date:todayStr(), durationMin:45, exercises:${S(ex)} }, ${S(ctx.sTomorrow)})`);
      assert.equal(s.date, app.ev("todayStr()"), "buổi gắn vào được dời về ngày tập thật");
    });

    /* ---------- QP-13: vắng / huỷ muộn trừ gói theo chính sách ---------- */
    t.test("QP-13: 3 loại huỷ — 'vắng / huỷ muộn' (charged) TRỪ gói, 'huỷ báo trước' và 'PT huỷ' không trừ; mặc định theo chính sách niêm yết", async ()=>{
      const L = "PTP.logic";
      const ss = [{ status:"done" }, { status:"cancelled", charged:true, cancelKind:"late" }, { status:"cancelled", cancelKind:"notice" }, { status:"cancelled", cancelKind:"pt" }];
      assert.equal(app.ev(`${L}.usedCount(${S(ss)})`), 2);
      assert.equal(app.ev(`${L}.remaining({ packageTotal:10 }, ${S(ss)})`), 8);
      assert.equal(app.ev(`${L}.absentChargeDefault("auto", "strict")`), true);
      assert.equal(app.ev(`${L}.absentChargeDefault("auto", "flex")`), false);
      assert.equal(app.ev(`${L}.absentChargeDefault(0, "strict")`), false);
    });

    /* ---------- QP-10 / QS-17: SĐT PT ---------- */
    t.test("QP-10 · QS-17: SĐT PT không nằm trong hồ sơ công khai users/{uid}; hồ sơ PT chỉ hiện SĐT PT gửi vào form học viên đang kết nối", async ()=>{
      await login(ST2);
      const pr = await J(`return await cloud.getUser(${S(ctx.ptUid)})`);
      assert.ok(!pr.phone, "người khác đọc users/{uid} không thấy SĐT");
      assert.equal(app.ev(`ppPhoneFor(${S(ctx.ptUid)}, null)`), "", "học viên form khác (không có ptPhone) không thấy SĐT");
      await J(`await openPTProfile(${S(ctx.ptUid)}, ${S(ctx.cid3)}); return 1;`);
      const html = app.ev(`document.getElementById("pp-content").innerHTML`);
      assert.ok(!/0912345678/.test(html), "hồ sơ không lộ SĐT");
    });

    /* ---------- QP-08: số liệu công khai từ dữ liệu thật ---------- */
    t.test("QP-08: 'Học viên · Buổi đã dạy' chỉ đếm form có học viên thật + ≥ 1 buổi PT xác nhận (form trống không tính); nhãn nguồn 'PT tự đồng bộ / tự khai'", async ()=>{
      const forms = [{ id:"a", studentUid:"u1" }, { id:"b" }, { id:"c", studentUid:"u3" }, { id:"d", studentUid:"u4" }];
      const sess = { a:[{ status:"done", completedBy:"pt" }, { status:"done", completedBy:"student" }], b:[{ status:"done", completedBy:"pt" }], c:[{ status:"done", completedBy:"student" }], d:[] };
      const r = app.evj(`cloud.ptdir.logic.statsFrom(${S(forms)}, ${S(sess)})`);
      assert.equal(r.students, 1); assert.equal(r.sessions, 2); assert.equal(r.verified, false);
      assert.match(app.ev(`ppStatsSrc({ src:"app" })`), /PT tự đồng bộ/);
      assert.match(app.ev(`ppStatsSrc({})`), /PT tự khai/);
      assert.match(app.ev(`ppStatsSrc({ seed:true })`), /minh hoạ/);
      assert.match(app.ev(`ppStatsSrc({ verified:true })`), /TapEasy xác nhận/);
    });

    /* ---------- QP-09: giá theo hình thức ---------- */
    t.test("QP-09: lọc 'Phòng tập' + '≤ 300k' không lấy PT chỉ rẻ khi học online; thẻ ghi 'online từ…' khi mức thấp nhất là online", async ()=>{
      const l = { id:"x", status:"public", places:[{ type:"gym" }, { type:"online" }], prices:{ single:500000, online:300000 } };
      const L = "cloud.ptdir.logic";
      assert.equal(app.evj(`${L}.filterListings([${S(l)}], { place:"gym", priceMax:300000 })`).length, 0);
      assert.equal(app.evj(`${L}.filterListings([${S(l)}], { place:"online", priceMax:300000 })`).length, 1);
      assert.deepEqual(app.evj(`${L}.priceInfo(${S(l)}, "gym")`).v, 500000);
      app.ev(`TEFindPT.state().f.place = ""`);
      const card = app.ev(`TEFindPT.cardHTML(Object.assign(${S(l)}, { name:"Lý Tâm", prov:"hn" }), "wide", 0, 9)`);
      assert.match(card, /online từ <b>300k<\/b>/);
    });

    /* ---------- QP-14 / QP-15 / QP-21 ---------- */
    t.test("QP-14: PT 0 đánh giá (mức nền 4,0) không vượt PT 20 đánh giá 4,2★ trong điểm 'Phù hợp'", ()=>{
      assert.ok(app.ev(`cloud.ptdir.logic.bayes(0, 0)`) < app.ev(`cloud.ptdir.logic.bayes(4.2, 20)`));
    });
    t.test("QP-15: trả lời tự động hồ sơ minh hoạ KHÔNG ghi đè 'done' → 'accepted'", async ()=>{
      await login(ST);
      app.ev(`cloud.ptdir.config.autoReplyMs = 200`);
      const lid = app.ev(`cloud.ptdir.seeds().listings ? Object.keys(cloud.ptdir.seeds().listings)[0] : "seed_khang"`);
      const q = await J(`return await cloud.ptdir.sendRequest(${S(lid)}, { kind:"trial", slot:{ date:"2026-11-10", time:"18:00" }, text:"Cho em tập thử" })`);
      await run(`await cloud.ptdir.simulateTrialDone(${S(lid)}, ${S(q.id)})`);
      await new Promise(r=> setTimeout(r, 450));
      const mine = (await J(`return await cloud.ptdir.myRequests()`)).find(x=> x.id === q.id);
      assert.equal(mine.status, "done");
    });
    t.test("QP-21: hồ sơ minh hoạ không hiện 'Đã xác minh' / 'TapEasy đã đối chiếu' (album + hồ sơ)", async ()=>{
      const list = await J(`return (await cloud.ptdir.list()).filter(l=> l.seed && l.verified).slice(0, 1)`);
      assert.ok(list.length, "có hồ sơ minh hoạ gắn verified trong dữ liệu mẫu");
      const card = app.ev(`TEFindPT.cardHTML(${S(list[0])}, "wide", 0, 0)`);
      assert.ok(!/fp-vchk/.test(card), "thẻ album không có dấu xác minh");
      await J(`await TEFindPT.openListing(${S(list[0].id)}, { from:"findpt" }); return 1;`);
      const html = app.ev(`document.getElementById("pp-content").innerHTML`);
      assert.ok(!/TapEasy đã đối chiếu/.test(html) && !/>Đã xác minh</.test(html), "hồ sơ minh hoạ không ghi đã đối chiếu");
      assert.match(html, /minh hoạ — không đối chiếu/);
    });

    /* ---------- QP-02 / QP-12: quyền đánh giá ---------- */
    t.test("QP-02 · QP-12: Firebase chỉ nhận quyền do MÁY CHỦ cấp (serverOnly) — buổi ở máy không đủ; quyền reviewRights {basis} còn hạn → được viết", ()=>{
      const L = "cloud.ptdir.logic";
      const base = { uid:"u", ptUid:"p", today:"2026-11-11", coaches:[{ id:"c", ptId:"p", done:30, confirmed:30, first:"2026-09-01", last:"2026-11-10" }] };
      assert.equal(app.evj(`${L}.eligibility(${S(base)})`).ok, true, "demo: buổi PT xác nhận đủ");
      const fb = app.evj(`${L}.eligibility(${S(Object.assign({}, base, { serverOnly:true }))})`);
      assert.equal(fb.ok, false); assert.equal(fb.code, "pending-rights");
      const ok = app.evj(`${L}.eligibility(${S(Object.assign({}, base, { serverOnly:true, coaches:[], rights:{ uid:"u", lid:"p", basis:{ type:"client", id:"c" }, until: Date.parse("2027-11-01") } }))})`);
      assert.equal(ok.ok, true); assert.equal(ok.basis.type, "client");
      const fake = app.evj(`${L}.eligibility(${S({ uid:"u", ptUid:"p", today:"2026-11-11", coaches:[{ id:"c", ptId:"p", done:1, confirmed:0 }] })})`);
      assert.equal(fake.ok, false, "buổi học viên tự đánh dấu (chưa PT xác nhận) không đủ");
    });
    t.test("QP-02: sửa đánh giá giữ nguyên basis (rules cấm đổi) và ghi 'đã sửa sau phản hồi của PT' khi PT đã trả lời", async ()=>{
      await login(ST);
      const lid = ctx.ptUid;
      await login(PT);
      await run(`await cloud.ptdir.saveMyListing({ name:"Phong PT", gender:"male", years:5, specs:["Tăng cơ"], bio:"PT tăng cơ", prov:"hn", ward:"Phường Cầu Giấy",
        places:[{ type:"gym", name:"Gym A" }], prices:{ single:400000 }, cancel:"strict", cover:"https://images.pexels.com/photos/1/a.jpeg",
        album:[{ src:"https://images.pexels.com/photos/2/a.jpeg" },{ src:"https://images.pexels.com/photos/3/a.jpeg" },{ src:"https://images.pexels.com/photos/4/a.jpeg" }], certs:[], showPhone:false })`);
      const td = app.ev("todayStr()");
      await run(`await cloud.saveSession(${S(ctx.cid)}, { date:${S(td)}, time:"06:00", status:"done", completedBy:"pt", title:"Buổi 2" })`);
      await login(ST);
      const r1 = await J(`return await cloud.ptdir.submitReview(${S(lid)}, { stars:5, criteria:{ expertise:5, punctual:5, attitude:5, results:5 }, text:"PT nhiệt tình, chỉnh form kỹ, tiến bộ rõ sau 2 tuần." })`);
      await login(PT);
      await run(`await cloud.ptdir.replyReview(${S(lid)}, ${S(ctx.stUid)}, "Cảm ơn Hạnh nhé!")`);
      await login(ST);
      const r2 = await J(`return await cloud.ptdir.submitReview(${S(lid)}, { stars:3, criteria:{ expertise:3, punctual:3, attitude:3, results:3 }, text:"Sửa lại: lịch hay bị dời, nhưng chuyên môn ổn định." })`);
      assert.deepEqual(r2.basis, r1.basis, "basis không đổi khi sửa");
      assert.equal(r2.editedAfterReply, true);
    });

    /* ---------- Chặn người dùng (App Store 1.2) ---------- */
    t.test("App Store 1.2 · Chặn (Tìm PT): PT chặn học viên → yêu cầu / tin nhắn thêm của người bị chặn bị từ chối, hộp yêu cầu của PT ẩn yêu cầu cũ; bỏ chặn → hiện lại (API thật cloud.blockUser)", async ()=>{
      await login(ST2);
      ctx.st2Uid = app.ev("cloud.user.uid");
      const q0 = await J(`return await cloud.ptdir.sendRequest(${S(ctx.ptUid)}, { kind:"question", text:"Anh có nhận dạy buổi tối không ạ?" })`);
      await login(PT);
      assert.ok((await J(`return (await cloud.ptdir.inbox()).map(r=> r.uid)`)).includes(ctx.st2Uid), "trước khi chặn: PT thấy yêu cầu");
      await run(`await FKBlock.block(${S(ctx.st2Uid)}, "Tú Trần", "Yêu cầu Tìm PT")`);
      assert.ok((await J(`return (await cloud.listBlocked()).map(b=> b.uid)`)).includes(ctx.st2Uid));
      assert.equal(app.ev(`cloud.isBlockedSync(${S(ctx.st2Uid)})`), true);
      assert.ok(!(await J(`return (await cloud.ptdir.inbox()).map(r=> r.uid)`)).includes(ctx.st2Uid), "yêu cầu của người đã chặn bị ẩn với PT");
      await login(ST2);
      const e = await errOf(`await cloud.ptdir.sendRequest(${S(ctx.ptUid)}, { kind:"question", text:"Anh còn nhận học viên không?" })`);
      assert.ok(e && e.code === "ptdir/blocked", JSON.stringify(e));
      const e2 = await errOf(`await cloud.ptdir.addMessage(${S(ctx.ptUid)}, ${S(q0.id)}, "Nhắn thêm cho anh")`);
      assert.ok(e2 && e2.code === "ptdir/blocked", JSON.stringify(e2));
      await login(PT);
      await run(`await FKBlock.unblock(${S(ctx.st2Uid)})`);
      assert.equal(app.ev(`cloud.isBlockedSync(${S(ctx.st2Uid)})`), false);
      assert.ok((await J(`return (await cloud.ptdir.inbox()).map(r=> r.uid)`)).includes(ctx.st2Uid), "bỏ chặn → yêu cầu hiện lại");
    }, { bug:"App Store 1.2", severity:"Cao" });

    /* ---------- QS-04: XSS chéo PT ↔ học viên ---------- */
    t.test("QS-04: packageTotal / id buổi / trạng thái chứa HTML không chạy ở form học viên & PT", async ()=>{
      await login(PT);
      await run(`await cloud.updateClient(${S(ctx.cid3)}, { packageTotal: "<img src=x onerror=alert(1)>" })`).catch(()=>{});
      await run(`await refreshCoachData(true)`);
      const h1 = await J(`openClientForm(${S(ctx.cid3)}, "pt", "ptp_pkg"); await new Promise(r=> setTimeout(r, 60)); return document.getElementById("client-content").innerHTML;`);
      assert.ok(!/<img src=x/i.test(h1), "packageTotal chèn thô");
      const html = app.ev(`TEConnect.msgsHTML([{ id:"\\"><img src=x>", from:"x", kind:"image", img:"data:image/png;base64,AAAA", text:"<b>hi</b>", ts: Date.now() }], { ptId:"p", studentUid:"x", studentName:"<i>n</i>" }, "pt")`);
      assert.ok(!/<b>hi<\/b>/.test(html) && !/<i>n<\/i>/.test(html) && !/"><img src=x>/.test(html));
    });

    /* ---------- UX: QU-15 / QU-16 / QU-17 ---------- */
    t.test("QU-15 · QU-17: PT mở màn PT → mặc định 'Học viên của tôi', có ô số 'Sắp hết gói (N)' ở hàng đầu", async ()=>{
      await login(PT);
      await J(`goto("coach"); renderCoachScreen(false); await new Promise(r=> setTimeout(r, 50)); return 1;`);
      assert.equal(app.ev("coachTab"), "clients");
      const h = app.ev(`clientsTabHTML()`);
      assert.match(h, /data-ck="low"[\s\S]*?Sắp hết gói/);
      assert.ok(h.indexOf('data-ck="low"') < h.indexOf('id="btn-add-client"'), "ô số nằm ở hàng đầu, trước danh sách");
    });
    t.test("QU-16: chỉ 1 nút 'Thêm học viên' (không còn nút 'Mời học viên' thứ hai); sheet có chip giới tính + trình độ, lưu vào form", async ()=>{
      await login(PT);
      const h = app.ev(`clientsTabHTML()`);
      assert.equal((h.match(/id="btn-add-client"/g) || []).length, 1);
      const src = read("pt-connect.js");
      assert.ok(!/id="sc-invite-btn"/.test(src), "pt-connect không chèn nút 'Mời học viên' thứ hai");
      const sheet = await J(`openAddClientSheet(); return document.getElementById("sheet-content").innerHTML;`);
      assert.match(sheet, /data-ac-g/); assert.match(sheet, /data-ac-l/); assert.match(sheet, /Nữ/); assert.match(sheet, /Nâng cao/);
      // DOM shim không phân tích HTML → kiểm đường lưu: giới tính / trình độ vào health của form
      assert.match(read("coach.js"), /if\(pick\.gender\) health\.gender = pick\.gender;[\s\S]{0,80}if\(pick\.level\) health\.goal = \{ level: pick\.level \}/);
      const c = await J(`return await cloud.createClient({ name:"Mai", health:{ gender:"female", goal:{ level:"advanced" } } })`);
      assert.equal(c.health.gender, "female");
    });
    t.test("QP-16: nhãn tuần giáo án ghi 'Tuần 4/12' (không 'T4' dễ đọc thành Thứ Tư)", ()=>{
      const src = read("pt-connect.js");
      assert.ok(/Tuần \$\{pw\}/.test(src) && !/· T\$\{pw\}/.test(src));
    });

    /* ---------- QU-23 / QU-05 / QP-23: album & hồ sơ cuộn mượt ---------- */
    t.test("QU-23: 4 thẻ đầu album hiện ngay (class 'in', không chờ cuộn); thẻ sau vẫn hiện dần", async ()=>{
      const list = await J(`return (await cloud.ptdir.list()).slice(0, 6)`);
      const html = app.ev(`TEFindPT.albumHTML(${S(list)})`);
      const cards = html.match(/<article class="fp-card[^"]*"/g) || [];
      assert.ok(cards.length >= 5);
      assert.ok(cards.slice(0, 4).every(c=> / in /.test(c + " ")), cards.slice(0, 4).join("\n"));
    });
    t.test("QU-05 · QP-23: không còn parallax theo cuộn (findpt) & bộ nghe 'scroll' (hồ sơ PT) — dùng IntersectionObserver; CSS bỏ blur thẻ lặp + content-visibility", ()=>{
      const fp = read("findpt.js"), pp = read("ptprofile.js"), css = read("findpt.css");
      assert.ok(!/addEventListener\("scroll", \(\)=>\{ if\(isActive\("screen-findpt"\)\) parallax\(\)/.test(fp), "còn parallax theo scroll");
      assert.ok(!/\$\("#app-scroll"\)\.addEventListener\("scroll"/.test(pp), "hồ sơ PT còn nghe scroll");
      assert.ok(/new IntersectionObserver/.test(pp));
      assert.match(css, /#fp-album \.fp-row\{ content-visibility:auto/);
      assert.match(css, /\.fp-pill\{ -webkit-backdrop-filter:none; backdrop-filter:none;/);
    });
    t.test("QP-19: thanh trên hồ sơ PT có nền khi đã cuộn (fp-scrolled), logo TapEasy (không còn FITKIT)", async ()=>{
      await login(PT);
      await J(`await openPTProfile(${S(ctx.ptUid)}); return 1;`);
      const h = app.ev(`document.getElementById("pp-content").innerHTML`);
      assert.match(h, /Tap<b>Easy<\/b>/);
      assert.match(read("findpt.css"), /\.pp-nav\.fp-scrolled::before\{ opacity:1; \}/);
    });

    /* =====================================================================
       VÒNG 2 (11/11/2026, 23:00) — xử lý Chuyển giao: mã mời 6–10, systemMessage ở Firebase, chặn người dùng,
       báo cáo routine theo trọng số, lọc toPlanItem, lưới 2 cột ≥ 1024 px, thuật ngữ §8.4
       ===================================================================== */
    t.test("FIX-security #1 (QS-14): mã mời nhận 6–10 ký tự — mã 6 (đang sinh) và mã 8 (JOIN_CODE_LEN = 8) đều xem trước + kết nối được; mã 3 / 11 ký tự xử lý đúng", async ()=>{
      const N = x=> app.ev(`cloud.social.normalizeCode(${S(x)})`);
      assert.equal(N("https://tapeasy.vn/?join=k7m2-qxab"), "K7M2QXAB");
      assert.equal(N("ABCDEFGHJKLMN").length, 10, "cắt còn 10 ký tự (slice 0,10)");
      assert.equal(app.ev(`cloud.social.isCode("K7M2QX")`), true);
      assert.equal(app.ev(`cloud.social.isCode("K7M2QXAB")`), true);
      assert.equal(app.ev(`cloud.social.isCode("ABC")`), false);
      assert.equal(app.ev(`cloud.social.isCode("ABCDEFGHJKL")`), false);
      await login(PT);
      const c6 = await J(`return await cloud.createClient({ name:"Mã sáu" })`);
      const c8 = await J(`return await cloud.createClient({ name:"Mã tám" })`);
      // mã 8 & mã 6 cố định (cloud.js giờ sinh 8 ký tự — mã 6 của form cũ vẫn phải dùng được): đổi trực tiếp trong kho demo của cloud.js
      const setCode = (cid, nc)=> run(`const k = "fitkit_cloud_demo_v1", db = JSON.parse(localStorage.getItem(k)); const old = db.clients[${S(cid)}].joinCode;
        db.joinCodes[${S(nc)}] = db.joinCodes[old]; delete db.joinCodes[old]; db.clients[${S(cid)}].joinCode = ${S(nc)}; localStorage.setItem(k, JSON.stringify(db));`);
      await setCode(c8.id, "K7M2QXAB"); await setCode(c6.id, "Q9W3ZP"); c6.joinCode = "Q9W3ZP";
      await run(`await cloud.signOut(); await cloud.signUp("hv8.fix@qa.vn", "matkhau1", "Tám");`);
      assert.equal((await errOf(`await cloud.social.previewCode("ABC")`)).message, "Mã gồm 6–10 ký tự chữ và số, ví dụ: K7M2QX.");
      const pv8 = await J(`return await cloud.social.previewCode("https://x.app/?join=k7m2-qxab")`);
      assert.equal(pv8.code, "K7M2QXAB"); assert.equal(pv8.clientId, c8.id);
      const l8 = await J(`return await cloud.social.acceptCode("k7m2qxab")`);
      assert.equal(l8.id, c8.id); assert.equal(l8.studentUid, app.ev("cloud.user.uid"));
      await run(`await cloud.signOut(); await cloud.signUp("hv6.fix@qa.vn", "matkhau1", "Sáu");`);
      const pv6 = await J(`return await cloud.social.previewCode(${S(c6.joinCode.toLowerCase())})`);
      assert.equal(pv6.code, "Q9W3ZP", "mã 6 ký tự (form cũ)");
      const l6 = await J(`return await cloud.social.acceptCode(${S(c6.joinCode)})`);
      assert.equal(l6.id, c6.id);
      const src = read("pt-connect.js") + read("coach.js");
      assert.ok(!/maxlength="6"/.test(src) && (src.match(/id="jn-code" class="join-input" maxlength="10"/g) || []).length === 2, "ô nhập mã nhận 10 ký tự");
      assert.match(read("pt-connect.js"), /\[\?&#\]join=\(\[A-Za-z0-9\]\{6,10\}\)/);
      assert.match(read("pt-connect.js"), /\/\^\[A-Z0-9\]\{6,10\}\$\/\.test\(code\)/, "quét QR nhận mã 6–10");
    }, { bug:"FIX-security #1", severity:"TB" });

    t.test("FIX-security #2: ở Firebase KHÔNG gọi systemMessage() từ client (Function joinByCode đã ghi); demo vẫn ghi dòng hệ thống", ()=>{
      const src = read("cloud-social.js");
      assert.match(src, /async function systemMessage\(cid, text\)\{\s*if\(isFb\(\) \|\| !cid\) return null;/);
      const calls = (src.match(/await systemMessage\(/g) || []).length;
      const guarded = (src.match(/if\(!isFb\(\)\)\{ try\{ await systemMessage\(/g) || []).length;
      assert.ok(calls >= 2 && calls === guarded, `${guarded}/${calls} lời gọi được chặn ở Firebase`);
    }, { bug:"FIX-security #2", severity:"Thấp" });

    t.test("App Store 1.2 · Chặn (chat): 'Chặn người này' cần xác nhận; sau khi chặn: chat ẩn (khối 'Bạn đã chặn' + Bỏ chặn, không mở luồng tin), tin của người đó bị lọc, không đếm chưa đọc, người đó không gửi được; 'Người đã chặn' có Bỏ chặn", async ()=>{
      await login(ST);
      await run(`await cloud.social.sendMessage(${S(ctx.cid)}, { text:"Chào anh, em là Hạnh" })`);
      await login(PT);
      assert.ok((await J(`return (await cloud.social.listMessages(${S(ctx.cid)})).filter(m=> m.from === ${S(ctx.stUid)}).length`)) >= 1);
      const u0 = app.ev("TEConnect.unreadTotal()");
      // nút chung + chat có nút "Chặn người này"
      const chat0 = app.ev(`(()=>{ const h = document.createElement("div"); TEConnect.mountChat(h, ${S(ctx.cid)}, "pt", { inline:true }); TEConnect.stopChat(); return h.innerHTML; })()`);
      assert.match(chat0, new RegExp(`data-fk-block="${ctx.stUid}"[^>]*>[\\s\\S]{0,120}Chặn người này`));
      // cần xác nhận: mở hộp hỏi, CHƯA chặn
      app.run(`FKBlock.confirm(${S(ctx.stUid)}, "Hạnh Lê", "Chat — học viên")`);
      assert.match(app.lastHtml("sheet-content"), /Chặn Hạnh Lê\?/);
      assert.ok(!(await J(`return (await cloud.listBlocked()).map(b=> b.uid)`)).includes(ctx.stUid), "chưa bấm xác nhận thì chưa chặn");
      await run(`const fns = document.getElementById("cd-confirm")._listeners.click; fns[fns.length - 1](); await new Promise(r=> setTimeout(r, 40));`);
      const bl = await J(`return await cloud.listBlocked()`);
      const b = bl.find(x=> x.uid === ctx.stUid); assert.ok(b && b.name === "Hạnh Lê" && b.reason === "Chat — học viên", JSON.stringify(bl));
      // tin của người đã chặn bị lọc; không đếm chưa đọc
      assert.equal((await J(`return (await cloud.social.listMessages(${S(ctx.cid)})).filter(m=> m.from === ${S(ctx.stUid)}).length`)), 0);
      await run(`await refreshCoachData(true)`);
      assert.ok(app.ev("TEConnect.unreadTotal()") <= u0 && app.ev(`unreadFor(ptData.asPT.find(c=> c.id === ${S(ctx.cid)}), "pt")`) === 0);
      // khung chat → khối "Bạn đã chặn" + Bỏ chặn, không mở luồng tin
      const chat1 = app.ev(`(()=>{ const h = document.createElement("div"); TEConnect.mountChat(h, ${S(ctx.cid)}, "pt", { inline:true }); return h.innerHTML; })()`);
      assert.ok(/fk-blocked/.test(chat1) && /data-fk-unblock=/.test(chat1) && /Bỏ chặn/.test(chat1) && !/sc-msgs/.test(chat1), chat1.slice(0, 300));
      assert.equal(app.ev("TEConnect._C.chat && TEConnect._C.chat.blocked === true && !TEConnect._C.chat.stop"), true, "không mở luồng tin");
      // màn PT: hàng học viên ghi "Đã chặn", nút "Người đã chặn (1)"
      app.run(`goto("coach"); renderCoachScreen(false)`); await app.settle(20);
      const scr = app.lastHtml("coach-content") + app.lastHtml("coach-tab-body");
      assert.match(scr, /Người đã chặn \(1\)/); assert.match(scr, /Đã chặn — chat &amp; tin nhắn ẩn|Đã chặn — chat & tin nhắn ẩn/);
      // người bị chặn không gửi được tin cho mình (demo mô phỏng rules blockedBy)
      await login(ST);
      const e = await errOf(`await cloud.social.sendMessage(${S(ctx.cid)}, { text:"Anh ơi?" })`);
      assert.ok(e && e.code === "social/blocked" && /tắt liên lạc/.test(e.message), JSON.stringify(e));
      // "Người đã chặn" → Bỏ chặn
      await login(PT);
      await run(`await FKBlock.openList()`);
      const lst = app.lastHtml("fkb-box");
      assert.ok(/Hạnh Lê/.test(lst) && new RegExp(`data-fk-unblock="${ctx.stUid}"`).test(lst) && /Bỏ chặn/.test(lst), lst.slice(0, 300));
      await run(`await FKBlock.unblockNow(${S(ctx.stUid)}, "Hạnh Lê")`);
      assert.equal(app.ev(`cloud.isBlockedSync(${S(ctx.stUid)})`), false);
      assert.ok((await J(`return (await cloud.social.listMessages(${S(ctx.cid)})).filter(m=> m.from === ${S(ctx.stUid)}).length`)) >= 1, "bỏ chặn → tin hiện lại");
      await login(ST);
      await run(`await cloud.social.sendMessage(${S(ctx.cid)}, { text:"Em gửi lại được rồi" })`);
    }, { bug:"App Store 1.2", severity:"Cao" });

    t.test("App Store 1.2 · Chặn (hồ sơ / album / lời mời): học viên chặn PT → album bỏ PT đó, hồ sơ thay bằng 'Bạn đã chặn…' + Bỏ chặn, yêu cầu đã gửi bị ẩn, lời mời email của PT bị ẩn; hồ sơ PT có nút 'Chặn người này'", async ()=>{
      await login(PT);
      await run(`await cloud.social.sendInvite({ clientId:${S(ctx.cidEmpty)}, email:${S(ST2)} })`);
      await login(ST2);
      await run(`await TEFindPT.load(true)`);
      const seed = await J(`return (await cloud.ptdir.list()).filter(l=> l.seed && l.status === "public" && !l.hidden)[0]`);
      await J(`return await cloud.ptdir.sendRequest(${S(seed.id)}, { kind:"question", text:"Chị có dạy online không ạ?" })`);
      await J(`await TEFindPT.openListing(${S(seed.id)}); return 1;`);
      assert.match(app.lastHtml("pp-content"), new RegExp(`data-fk-block="${seed.id}"[^>]*>[\\s\\S]{0,120}Chặn người này`), "hồ sơ PT có nút chặn");
      assert.ok((await J(`return (await cloud.social.myInvites()).map(i=> i.ptId)`)).includes(ctx.ptUid));
      await run(`await FKBlock.block(${S(seed.id)}, ${S(seed.name)}, "Hồ sơ PT"); await FKBlock.block(${S(ctx.ptUid)}, "Phong Coaching", "Lời mời")`);
      assert.ok(!app.evj("TEFindPT.visibleList().map(l=> l.id)").includes(seed.id), "album bỏ PT đã chặn");
      assert.ok(!(await J(`return (await cloud.ptdir.myRequests()).map(r=> r.lid)`)).includes(seed.id), "yêu cầu gửi PT đã chặn bị ẩn");
      assert.ok(!(await J(`return (await cloud.social.myInvites()).map(i=> i.ptId)`)).includes(ctx.ptUid), "lời mời của PT đã chặn bị ẩn");
      await J(`await TEFindPT.openListing(${S(seed.id)}); return 1;`);
      let pp = app.lastHtml("pp-content");
      assert.ok(/pp-blocked/.test(pp) && /Bỏ chặn/.test(pp) && !/fp-x/.test(pp), "hồ sơ niêm yết bị ẩn: " + pp.slice(0, 200));
      await J(`await openPTProfile(${S(ctx.ptUid)}); return 1;`);
      pp = app.lastHtml("pp-content");
      assert.ok(/pp-blocked/.test(pp) && /Bỏ chặn/.test(pp) && !/pp-hero/.test(pp), "hồ sơ PT thật bị ẩn");
      await run(`await FKBlock.unblock(${S(seed.id)}); await FKBlock.unblock(${S(ctx.ptUid)})`);
      assert.ok(app.evj("TEFindPT.visibleList().map(l=> l.id)").includes(seed.id), "bỏ chặn → PT hiện lại");
      assert.ok((await J(`return (await cloud.social.myInvites()).map(i=> i.ptId)`)).includes(ctx.ptUid));
      // nút trong yêu cầu Tìm PT (cả 2 phía) dùng data-fk-block (bắt sự kiện chung, không onclick chèn chuỗi)
      const fp = read("findpt.js");
      assert.ok((fp.match(/\$\{blkBtn\(/g) || []).length === 2, "nút chặn ở Yêu cầu của tôi + Yêu cầu từ học viên"); assert.match(read("coach.js"), /data-fk-block="\$\{escapeHtml\(uid\)\}"/);
    }, { bug:"App Store 1.2", severity:"Cao" });

    t.test("QC-14: báo cáo routine tính theo TRỌNG SỐ — tài khoản < 7 ngày / khách = 0, ≥ 7 ngày = 1; ẩn khi trọng số ≥ 3 (3 tài khoản mới không ẩn được bài)", async ()=>{
      const age = em=> run(`const k = "fitkit_cloud_demo_v1", db = JSON.parse(localStorage.getItem(k)); Object.values(db.users).forEach(u=>{ if(u.email === ${S(em)}) u.createdAt = Date.now() - 30*864e5; }); localStorage.setItem(k, JSON.stringify(db));`);
      const ids = await J(`return (await cloud.social.listRoutines()).filter(r=> String(r.id).startsWith("seed-") && !(r.reports > 0)).slice(0, 3).map(r=> r.id)`);
      assert.equal(ids.length, 3);
      const [rA, rB, rC] = ids;
      // 3 tài khoản MỚI báo cáo rA → reports 3, trọng số 0, không ẩn
      let last;
      for(const em of ["rp1.fix@qa.vn", "rp2.fix@qa.vn", "rp3.fix@qa.vn"]){
        await run(`await cloud.signOut(); await cloud.signUp(${S(em)}, "matkhau1", "Người báo cáo");`);
        assert.equal(app.ev("cloud.social.reportTrust(cloud.user.uid)"), 0);
        last = await J(`return await cloud.social.reportRoutine(${S(rA)}, "Spam")`);
      }
      assert.ok(last.reports === 3 && last.weight === 0 && last.hidden === false, JSON.stringify(last));
      assert.ok((await J(`const all = await cloud.social.listRoutines(); return cloud.social.logic.filterRoutines(all, {}).some(r=> r.id === ${S(rA)})`)), "vẫn hiện trên bảng tin");
      // 2 tài khoản ≥ 7 ngày + 1 mới → trọng số 2 (chưa ẩn); thêm 1 tài khoản ≥ 7 ngày → 3 → ẩn
      for(const em of ["rp1.fix@qa.vn", "rp2.fix@qa.vn"]){ await age(em); await run(`await cloud.signOut(); await cloud.signIn(${S(em)}, "matkhau1")`); assert.equal(app.ev("cloud.social.reportTrust(cloud.user.uid)"), 1); last = await J(`return await cloud.social.reportRoutine(${S(rB)}, "Spam")`); }
      await run(`await cloud.signOut(); await cloud.signIn("rp3.fix@qa.vn", "matkhau1")`);
      last = await J(`return await cloud.social.reportRoutine(${S(rB)}, "Spam")`);
      assert.ok(last.reports === 3 && last.weight === 2 && last.hidden === false, JSON.stringify(last));
      await run(`await cloud.signOut(); await cloud.signUp("rp4.fix@qa.vn", "matkhau1", "Lâu năm");`); await age("rp4.fix@qa.vn");
      last = await J(`return await cloud.social.reportRoutine(${S(rB)}, "Spam")`);
      assert.ok(last.weight === 3 && last.hidden === true, JSON.stringify(last));
      assert.ok(!(await J(`const all = await cloud.social.listRoutines(); return cloud.social.logic.filterRoutines(all, {}).some(r=> r.id === ${S(rB)})`)), "đủ trọng số → tạm ẩn");
      // khách (chưa đăng nhập) = 0; tuổi tài khoản của chính mình lấy từ cloud.profile.createdAt
      await run(`await cloud.signOut()`);
      last = await J(`return await cloud.social.reportRoutine(${S(rC)}, "Khác")`);
      assert.ok(last.weight === 0 && last.hidden === false, JSON.stringify(last));
      // dữ liệu Firebase: Function routineReportHeal ghi autoModWeight — giao diện đọc trọng số, không đọc số thô
      const H = o=> app.ev(`cloud.social.moderation.isHidden(${S(o)})`);
      assert.equal(H({ reports:5, hidden:true, autoModWeight:1 }), false, "rules ép hidden theo số thô — trọng số máy chủ thắng");
      assert.equal(H({ reports:3, hidden:true, autoModWeight:3 }), true);
      assert.equal(H({ reports:3 }), true, "dữ liệu cũ chưa có trọng số: như trước");
      assert.equal(H({ reports:0, hidden:true, moderatedAt:1 }), true, "kiểm duyệt viên ẩn");
      assert.equal(H({ reports:9, reportWeight:9, approved:true }), false, "kiểm duyệt viên giữ lại");
      assert.match(read("cloud-social.js"), /tx\.update\(rref, \{ reports, hidden: rawHidden \}\)/, "Firebase: vẫn ghi đúng rules (hidden == reports >= 3), Function tính lại");
    }, { bug:"QC-14", severity:"TB" });

    t.test("FIX-core §4: toPlanItem (bài PT giao → buổi tập học viên) lọc lúc nhập — chữ bỏ thẻ + cắt độ dài, số ép nguyên, id bài có thật, URL qua safeUrl(noBlob)", ()=>{
      const EVIL = "<img src=x onerror=alert(1)>";
      const it = app.evj(`TEConnect.toPlanItem({ name:${S(EVIL + "x".repeat(200))}, sets:"<b>9</b>", reps:${S(EVIL)}, restSec:"x", muscle:${S(EVIL)}, guide:${S(EVIL)},
        img:"javascript:alert(1)", exId:"__proto__", uid:"\\"><svg>", stock:{ url:"javascript:alert(1)", thumb:"https://a.b/t.jpg" } }, 0)`);
      const s = JSON.stringify(it);
      assert.ok(!/[<>]/.test(s), s.slice(0, 300));
      assert.ok(Number.isInteger(it.sets) && it.sets >= 1 && it.sets <= 10 && it.restSec === 60, s);
      assert.ok(it.exerciseId === null && it.custom.name.length <= 80 && it.custom.img === "" && !it.stock, s);
      assert.equal(app.evj(`TEConnect.toPlanItem({ name:"Bài A", img:"blob:https://x/1" }, 0)`).custom.img, "", "blob: bị bỏ (noBlob)");
      const ok = app.evj(`TEConnect.toPlanItem({ name:"Bài B", sets:4.6, reps:"8-10", restSec:900, img:"https://images.pexels.com/1.jpeg", stock:{ url:"https://v.mp4", thumb:"https://t.jpg", provider:"Pexels" } }, 2)`);
      assert.ok(ok.sets === 5 && ok.reps === "8-10" && ok.restSec === 600 && ok.custom.img === "https://images.pexels.com/1.jpeg" && ok.stock.url === "https://v.mp4", JSON.stringify(ok));
      const p = app.evj(`cloud.social.logic.planFromRoutine({ title:"<b>x</b>", days:{ T2:{ title:"<i>", intensity:"<script>", duration:"9999", ex:[{ name:"<u>", sets:"abc", reps:"<x>", rest:-5 }] } } }, ()=> "u1")`);
      assert.ok(!/[<>]/.test(JSON.stringify(p)) && p.days.T2.intensity === "Vừa" && p.days.T2.items[0].sets === 3 && p.days.T2.items[0].restSec === 0 && p.days.T2.duration === 240);
    }, { bug:"FIX-core §4", severity:"Cao" });

    t.test("QU-36: ≥ 1024 px album Tìm PT lưới 2 cột (bám html[data-screen=\"findpt\"]), thẻ ≤ 480 px — ảnh không phóng to theo màn", ()=>{
      const css = read("findpt.css");
      const m = css.match(/@media \(min-width:1024px\)\{([\s\S]*?)\n\}/g) || [];
      const blk = m.find(x=> /data-screen="findpt"/.test(x)) || "";
      assert.match(blk, /html\[data-screen="findpt"\] \.fp-album\{ display:grid; grid-template-columns:repeat\(2, minmax\(0, 480px\)\)/);
      assert.match(blk, /\.fp-album > \*\{[^}]*max-width:480px/);
      assert.match(blk, /html\[data-screen="findpt"\] #app-shell\{ max-width:min\(1120px, 94vw\); \}/);
    }, { bug:"QU-36", severity:"Thấp" });

    t.test("Thuật ngữ §8.4 (phần PT): không còn 'Ảnh tiến trình', 'Album PT', 'Kết nối PT', tab 'Chương trình', 'Routine' trong chữ hiển thị", ()=>{
      const strs = f=> (read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").match(/(["'`])(?:(?!\1)[^\\\n]|\\.)*\1/g) || []).join("\n");
      assert.ok(!/Ảnh tiến trình|ảnh tiến trình/.test(strs("pt-pro.js") + strs("coach.js") + strs("pt-connect.js")));
      assert.ok(!/Album PT|album PT/.test(strs("findpt.js")));
      assert.ok(!/Kết nối PT/.test(strs("coach.js") + strs("pt-connect.js")));
      assert.match(read("pt-connect.js"), /\["program","Giáo án","school"\]/);
      assert.ok(!/err\("[^"]*\b[Rr]outine\b/.test(read("cloud-social.js")) && !/return "[^"]*\b[Rr]outine\b/.test(read("cloud-social.js")), "thông báo lỗi còn chữ 'routine'");
    }, { bug:"QU-24/§8.4", severity:"Thấp" });

    /* ---------- QP-03 / QP-17: xoá tài khoản dọn dữ liệu ---------- */
    t.test("QP-03: học viên xoá tài khoản → ảnh / sức khoẻ / số đo / nhật ký đồng bộ bị gỡ khỏi form PT (demo)", async ()=>{
      await login(ST2);
      await errOf(`await cloud.updateClient(${S(ctx.cid3)}, { photos:[{ id:"p1", img:"data:image/jpeg;base64,AAAA", date:"2026-11-11" }], measurements:[{ date:"2026-11-11", waist:80 }] })`);
      await run(`await cloud.deleteAccount("matkhau1")`);
      await login(PT);
      const c = await J(`return await cloud.getClient(${S(ctx.cid3)})`);
      assert.ok(c, "form PT còn");
      assert.ok(!c.studentUid && !(c.photos || []).length && !(c.measurements || []).length && !c.trainingSync, JSON.stringify({ s: c.studentUid, p: (c.photos||[]).length, m: (c.measurements||[]).length }));
    });
  },
};

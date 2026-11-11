/* TapEasy — PT Connect & Cộng đồng (cloud-social.js + pt-connect.js + community.js), động cơ DEMO
   Chạy riêng: node tests/run.js --only social
   Nạp app thật (index.html) + 3 module mới ngay sau pt-pro.js (đúng thứ tự trong INTEGRATION-social.md). */
"use strict";
const { assert } = require("../lib/framework");
const { scriptOrder } = require("../lib/harness");

const MODS = ["cloud-social.js", "pt-connect.js", "community.js"];
function order(){
  const base = scriptOrder().filter(f=> !MODS.includes(f));
  let i = base.indexOf("pt-pro.js"); if(i < 0) i = base.indexOf("pt.js");
  return base.slice(0, i+1).concat(MODS, base.slice(i+1));
}

module.exports = {
  name: "TapEasy PT Connect & Cộng đồng (demo)",
  area: "Xã hội (cloud-social.js · pt-connect.js · community.js)",
  async define(t){
    const app = await t.app({ scripts: order(), settleMs: 120 });
    const run = code=> app.ev(`(async()=>{ ${code} })()`);
    const J = async code=>{ const v = await run(code); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
    const errOf = async code=>{ try{ await run(code); return null; }catch(e){ return { message: e.message, code: e.code }; } };
    const login = (email, pw)=> run(`await cloud.signOut(); await cloud.signIn(${JSON.stringify(email)}, ${JSON.stringify(pw || "matkhau1")});`);
    const td = app.ev("todayStr()");
    const ctx = {};

    t.test("Module nạp không lỗi, cloud.social ở chế độ demo, ≥ 12 routine mẫu của TapEasy Team", ()=>{
      assert.deepEqual(app.loadErrors.map(e=> e.file), []);
      assert.equal(app.ev("cloud.social.engine"), "demo");
      assert.equal(app.ev("TEConnect.installed"), true);
      assert.equal(app.ev("TECommunity.installed"), true);
      const seeds = app.evj("cloud.social.seeds.map(s=>({id:s.id, a:s.authorName, n:Object.values(s.days).filter(d=>d.ex.length).length, bad:Object.values(s.days).flatMap(d=>d.ex).filter(e=>!EXERCISES[e.id]).length}))");
      assert.ok(seeds.length >= 12, "số routine mẫu: " + seeds.length);
      assert.ok(seeds.every(s=> s.a === "TapEasy Team" && s.n >= 3 && s.bad === 0), JSON.stringify(seeds.filter(s=> s.a !== "TapEasy Team" || s.n < 3 || s.bad)));
      assert.deepEqual(app.evj("['sc_chat','sc_track'].map(id=> CF_TABS.some(t=> t.id===id))"), [true, true]);
    });

    t.test("PT mời bằng email: chuẩn hoá email, chống gửi trùng, kiểm tra lỗi", async ()=>{
      await run(`await cloud.signUp("pt.an@tapeasy.vn", "matkhau1", "An PT"); await cloud.updateMyProfile({ isPT:true, brandName:"An Coaching", specialty:"Tăng cơ, giảm mỡ" });`);
      const c = await J(`return await cloud.createClient({ name:"Lan", goal:"Giảm 5 kg", startDate:todayStr(), packageTotal:12 })`);
      ctx.cid = c.id; ctx.code = c.joinCode;
      const inv = await J(`return await cloud.social.sendInvite({ clientId:${JSON.stringify(c.id)}, email:"  Lan@Mail.VN ", message:"Chào Lan" })`);
      assert.equal(inv.email, "lan@mail.vn"); assert.equal(inv.status, "pending"); assert.equal(inv.ptBrand, "An Coaching"); assert.equal(inv.code, c.joinCode);
      const again = await J(`return await cloud.social.sendInvite({ clientId:${JSON.stringify(c.id)}, email:"lan@mail.vn" })`);
      assert.equal(again.id, inv.id, "gửi lại cùng email → dùng lại lời mời đang chờ");
      assert.equal((await errOf(`await cloud.social.sendInvite({ clientId:${JSON.stringify(c.id)}, email:"khong-hop-le" })`)).code, "social/email");
      assert.equal((await errOf(`await cloud.social.sendInvite({ clientId:${JSON.stringify(c.id)}, email:"pt.an@tapeasy.vn" })`)).code, "social/self");
      const c2 = await J(`return await cloud.createClient({ name:"Minh" })`); ctx.cid2 = c2.id;
      await run(`await cloud.social.sendInvite({ clientId:${JSON.stringify(c2.id)}, email:"minh@mail.vn" })`);
      assert.equal((await J(`return (await cloud.social.sentInvites()).length`)), 2);
    });

    t.test("Học viên thấy lời mời → Chấp nhận: form liên kết, lời mời 'accepted', PT nhận tin hệ thống", async ()=>{
      await run(`await cloud.signOut(); await cloud.signUp("lan@mail.vn", "matkhau1", "Lan Nguyễn");`);
      const list = await J(`return await cloud.social.myInvites()`);
      assert.equal(list.length, 1); assert.equal(list[0].ptName, "An PT");
      const html = await run(`TEConnect._C.invites = await cloud.social.myInvites(); return TEConnect.inboxHTML();`);
      assert.ok(html.includes("Hộp thư lời mời") && html.includes("An Coaching") && html.includes("data-inv-accept"), "HTML hộp thư lời mời");
      const c = await J(`return await cloud.social.acceptInvite(${JSON.stringify(list[0].id)})`);
      assert.equal(c.studentName, "Lan Nguyễn"); assert.equal(c.studentUid, app.ev("cloud.user.uid"));
      ctx.lanUid = c.studentUid;
      assert.equal((await J(`return await cloud.social.myInvites()`)).length, 0);
      assert.equal((await errOf(`await cloud.social.acceptInvite(${JSON.stringify(list[0].id)})`)).code, "social/expired");
      const msgs = await J(`return await cloud.social.listMessages(${JSON.stringify(ctx.cid)})`);
      assert.equal(msgs.length, 1); assert.equal(msgs[0].kind, "system");
    });

    t.test("Từ chối lời mời → PT thấy trạng thái 'declined'", async ()=>{
      await run(`await cloud.signOut(); await cloud.signUp("minh@mail.vn", "matkhau1", "Minh");`);
      const [inv] = await J(`return await cloud.social.myInvites()`);
      await run(`await cloud.social.declineInvite(${JSON.stringify(inv.id)})`);
      await login("pt.an@tapeasy.vn");
      const sent = await J(`return await cloud.social.sentInvites(${JSON.stringify(ctx.cid2)})`);
      assert.equal(sent[0].status, "declined");
      const c2 = await J(`return await cloud.getClient(${JSON.stringify(ctx.cid2)})`);
      assert.equal(c2.studentUid, null, "từ chối không liên kết form");
    });

    t.test("Mã mời: xem trước PT, mã sai / mã của chính mình báo lỗi tiếng Việt, chấp nhận bằng mã (cả link ?join=)", async ()=>{
      const c3 = await J(`return await cloud.createClient({ name:"Hà" })`);
      assert.equal((await errOf(`await cloud.social.previewCode(${JSON.stringify(c3.joinCode)})`)).code, "social/self");
      await run(`await cloud.signOut(); await cloud.signUp("ha@mail.vn", "matkhau1", "Hà");`);
      assert.equal((await errOf(`await cloud.social.previewCode("ABC")`)).message, "Mã gồm 6–10 ký tự chữ và số, ví dụ: K7M2QX.");   // fix-pt vòng 2: mã 6–10 ký tự (FIX-security #1)
      assert.match((await errOf(`await cloud.social.previewCode("ZZZZZZ")`)).message, /Mã không đúng/);
      const pv = await J(`return await cloud.social.previewCode("https://x.app/?join=" + ${JSON.stringify(c3.joinCode.toLowerCase())})`);
      assert.equal(pv.code, c3.joinCode); assert.equal(pv.pt.brandName, "An Coaching"); assert.equal(pv.linked, false);
      const c = await J(`return await cloud.social.acceptCode(${JSON.stringify(c3.joinCode)})`);
      assert.equal(c.studentName, "Hà");
      await run(`await cloud.signOut(); await cloud.signUp("ke@mail.vn", "matkhau1", "Kẻ khác");`);
      const pv2 = await J(`return await cloud.social.previewCode(${JSON.stringify(c3.joinCode)})`);
      assert.equal(pv2.linked, true, "mã đã có người dùng → báo trước khi bấm chấp nhận");
    });

    t.test("Chat: chưa đọc, đã xem, ảnh nén hợp lệ, người ngoài không gửi được", async ()=>{
      await login("lan@mail.vn");
      await run(`await cloud.social.sendMessage(${JSON.stringify(ctx.cid)}, { text:"Chào PT, mai em tập lúc 18h nhé" })`);
      assert.equal((await errOf(`await cloud.social.sendMessage(${JSON.stringify(ctx.cid)}, { text:"   " })`)).code, "social/empty");
      assert.equal((await errOf(`await cloud.social.sendMessage(${JSON.stringify(ctx.cid)}, { img:"data:text/html;base64,PHA+" })`)).code, "social/img");
      await run(`await cloud.social.sendMessage(${JSON.stringify(ctx.cid)}, { img:"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==" })`);
      await login("pt.an@tapeasy.vn");
      let c = await J(`return await cloud.getClient(${JSON.stringify(ctx.cid)})`);
      assert.equal(app.evj(`cloud.social.chatInfo(${JSON.stringify(c)}, "pt")`).unread, 3, "1 tin hệ thống + 1 chữ + 1 ảnh");
      const msgs = await J(`return await cloud.social.listMessages(${JSON.stringify(ctx.cid)})`);
      assert.deepEqual(msgs.map(m=> m.kind), ["system", "text", "image"]);
      await run(`await cloud.social.markRead(${JSON.stringify(ctx.cid)}, "pt")`);
      c = await J(`return await cloud.getClient(${JSON.stringify(ctx.cid)})`);
      const info = app.evj(`cloud.social.chatInfo(${JSON.stringify(c)}, "pt")`);
      assert.equal(info.unread, 0); assert.ok(info.myReadAt >= msgs[2].ts);
      await run(`await cloud.social.sendMessage(${JSON.stringify(ctx.cid)}, { text:"Ok em, nhớ ăn nhẹ trước 1 tiếng" })`);
      const si = app.evj(`cloud.social.chatInfo(${JSON.stringify(await J(`return await cloud.getClient(${JSON.stringify(ctx.cid)})`))}, "student")`);
      assert.equal(si.unread, 1); assert.ok(si.otherReadAt >= msgs[1].ts, "học viên thấy 'Đã xem'");
      await login("minh@mail.vn");
      assert.equal((await errOf(`await cloud.social.sendMessage(${JSON.stringify(ctx.cid)}, { text:"xin chào" })`)).code, "permission-denied");
    });

    t.test("watchMessages (demo): gọi ngay lần đầu, refresh() thấy tin mới, stop() dừng", async ()=>{
      await login("lan@mail.vn");
      await run(`globalThis.__w = []; globalThis.__stop = cloud.social.watchMessages(${JSON.stringify(ctx.cid)}, l=> __w.push(l.length));`);
      await app.settle(30);
      assert.equal(app.ev("__w.length"), 1);
      const n0 = app.ev("__w[0]");
      await run(`await cloud.social.sendMessage(${JSON.stringify(ctx.cid)}, { text:"Em đến rồi" }); await __stop.refresh();`);
      assert.equal(app.ev("__w[__w.length-1]"), n0 + 1);
      await run(`__stop(); await cloud.social.sendMessage(${JSON.stringify(ctx.cid)}, { text:"test" }); await __stop.refresh();`);
      assert.ok(app.ev("__w.length") <= 3);
    });

    t.test("PT 'Tập cùng — log thay' → buổi Đã tập + tin nhắn; học viên mở app → vào setLog/setHist/nhật ký, không áp 2 lần", async ()=>{
      await login("pt.an@tapeasy.vn");
      const s = await J(`return await cloud.saveSession(${JSON.stringify(ctx.cid)}, { date: todayStr(), time:"18:00", mode:"offline", status:"scheduled", title:"Lower — nặng", exercises:[{ uid:"a", name:EXERCISES.squat.name, exId:"squat", sets:3, reps:"5-8", restSec:180, done:false }] })`);
      const saved = await J(`return await cloud.social.saveProxyLog(${JSON.stringify(ctx.cid)}, { title:"Lower — nặng", date: todayStr(), durationMin: 55, note:"Squat sâu hơn tuần trước",
        exercises:[ { key:"squat", exerciseId:"squat", name:EXERCISES.squat.name, reps:"5-8", sets:[{kg:80,reps:6,done:true},{kg:82.5,reps:5,done:true},{kg:82.5,reps:4,done:false}] },
                    { key:"rdl", exerciseId:"rdl", name:EXERCISES.rdl.name, reps:"8-10", sets:[{kg:60,reps:10,done:true}] },
                    { key:"plank", exerciseId:"plank", name:EXERCISES.plank.name, reps:"45 giây", timed:true, sets:[{kg:0,reps:0,done:true}] } ] }, ${JSON.stringify(s.id)})`);
      assert.equal(saved.id, s.id); assert.equal(saved.status, "done"); assert.equal(saved.completedBy, "pt");
      assert.equal(saved.proxyLog.sets, 4, "chỉ hiệp đã ✓ được lưu"); assert.equal(saved.proxyLog.volume, Math.round(80*6 + 82.5*5 + 60*10));
      assert.equal(saved.exercises[0].done, true); assert.ok(saved.exercises.some(e=> e.exId === "rdl"), "bài thêm mới được nối vào buổi");
      const msgs = await J(`return await cloud.social.listMessages(${JSON.stringify(ctx.cid)})`);
      assert.equal(msgs[msgs.length-1].kind, "log");
      assert.equal((await errOf(`await cloud.social.saveProxyLog(${JSON.stringify(ctx.cid)}, { exercises:[] })`)).code, "social/empty");
      ctx.sid = s.id;
      // học viên mở app
      await login("lan@mail.vn");
      await run(`state.setHist = { squat:{ name:EXERCISES.squat.name, list:[{ date:"2026-01-05", e1rm:85, top:75, vol:1500, sets:[{kg:75,reps:4}] }] } }; state.finishedDates = state.finishedDates.filter(d=> d!==todayStr()); state.ptConnect = { applied:{}, syncHash:{} };
        await refreshCoachData(true); await new Promise(r=> setTimeout(r, 80));`);
      const h = app.evj("state.setHist.squat.list");
      const today = h.find(x=> x.date === td);
      assert.ok(today, "có 1RM hôm nay"); assert.equal(today.top, 82.5); assert.ok(Math.abs(today.e1rm - 96.3) < 0.2, "e1rm " + today.e1rm);
      assert.equal(app.evj("state.setLog.squat").date, td);
      assert.ok(app.ev("state.finishedDates.includes(todayStr())"));
      assert.equal(app.evj("state.workoutLog[todayStr()].byPT").title, "Lower — nặng");
      assert.equal(app.evj("state.setLog.plank").date, td, "bài tính giờ vẫn ghi setLog");
      assert.ok(app.evj("state.ptConnect.applied")[ctx.sid]);
      const ss = await J(`return (await cloud.listSessions(${JSON.stringify(ctx.cid)})).find(x=> x.id === ${JSON.stringify(ctx.sid)})`);
      assert.ok(ss.proxyApplied > 0, "đánh dấu proxyApplied trên máy chủ");
      // không áp lại
      await run(`state.ptConnect.applied = {}; await refreshCoachData(true); await new Promise(r=> setTimeout(r, 60));`);
      assert.equal(app.evj("state.setHist.squat.list").find(x=> x.date === td).sets.length, 2);
    });

    t.test("Đồng bộ nhật ký tập lên form (≤ 60 KB) → PT xem tiến độ (cân nặng · 1RM · chuyên cần)", async ()=>{
      await run(`state.inbodyLogs = [{ id:1, ts: Date.now() - 20*86400000, weight: 62.4 }, { id:2, ts: Date.now() - 2*86400000, weight: 61.1 }]; state.ptConnect.syncHash = {}; await TEConnect.syncNow(true);`);
      const c = await J(`return await cloud.getClient(${JSON.stringify(ctx.cid)})`);
      const sync = c.trainingSync;
      assert.ok(sync && sync.ex && sync.ex.squat, "có squat trong trainingSync");
      assert.deepEqual(sync.ex.squat.last.s, [[80,6],[82.5,5]]);
      assert.ok(JSON.stringify(sync).length <= 60000);
      assert.equal(sync.weights.length, 2);
      assert.ok(sync.workouts.some(w=> w.d === td && w.by === "pt"));
      // băm ổn định → không ghi lại khi không đổi
      const pushed = await run(`return await TEConnect.syncNow(false)`);
      assert.equal(pushed, false);
      await login("pt.an@tapeasy.vn");
      await run(`await refreshCoachData(true);`);
      const m = await J(`const c = ptData.asPT.find(x=> x.id === ${JSON.stringify(ctx.cid)}); const m = TEConnect.progressModel(c, "pt"); return { w:m.weights.length, ex:m.exs.map(e=>e.key), weeks:m.weeks.length, pt:m.weeks[7].pt, done:m.done }`);
      assert.equal(m.w, 2); assert.ok(m.ex.includes("squat")); assert.equal(m.weeks, 8); assert.equal(m.pt, 1); assert.equal(m.done, 1);
      const html = await run(`const c = ptData.asPT.find(x=> x.id === ${JSON.stringify(ctx.cid)}); return TEConnect.progressHTML(c, "pt");`);
      assert.ok(html.includes("<svg") && html.includes("Cân nặng") && html.includes("1RM") && html.includes("Chuyên cần"));
    });

    t.test("Nhật ký: học viên tập buổi PT giao trong app → buổi 'done' + studentLog gửi về PT", async ()=>{
      const s = await J(`return await cloud.saveSession(${JSON.stringify(ctx.cid)}, { date: todayStr(), time:"19:00", mode:"offline", status:"scheduled", title:"Upper", exercises:[{ uid:"b1", name:EXERCISES.benchpress.name, exId:"benchpress", sets:2, reps:"6-8", restSec:120 }, { uid:"b2", name:"Kéo cáp tay đơn tự đặt", sets:2, reps:"12", restSec:60 }] })`);
      await login("lan@mail.vn");
      await run(`await refreshCoachData(true); TEConnect.startPTSession(${JSON.stringify(ctx.cid)}, ${JSON.stringify(s.id)});`);
      const items = app.evj("session.items.map(i=>({e:i.exerciseId, c:i.custom && i.custom.name}))");
      assert.deepEqual(items, [{ e:"benchpress", c:null }, { e:null, c:"Kéo cáp tay đơn tự đặt" }]);
      await run(`session.sets = {}; session.items.forEach(it=> session.sets[it.uid] = [{kg:50,reps:8,rpe:"",done:true},{kg:50,reps:7,rpe:"",done:true}]);
        session.items.forEach(it=> recordExerciseResult(exKey(it), getExerciseMeta(it).name, it.reps, [{kg:50,reps:8},{kg:50,reps:7}], false));
        session.completed = session.items.map(i=> i.uid); session.idx = session.items.length; finishSession(); await new Promise(r=> setTimeout(r, 80));`);
      const after = await J(`return (await cloud.listSessions(${JSON.stringify(ctx.cid)})).find(x=> x.id === ${JSON.stringify(s.id)})`);
      assert.equal(after.status, "done"); assert.equal(after.completedBy, "student");
      assert.equal(after.studentLog.exercises.length, 2); assert.equal(after.exercises[0].result, "50×8 · 50×7");
      assert.ok(app.ev("state.workoutLog[todayStr()].ptSession.sid") === s.id);
    });

    t.test("Huy hiệu chưa đọc: tổng tin chưa đọc + lời mời", async ()=>{
      const n = await run(`await refreshCoachData(true); return TEConnect.unreadTotal();`);
      assert.ok(n >= 1, "học viên có tin PT chưa đọc: " + n);
      const html = app.ev(`document.getElementById("nav-coach-dot") && 1`);
      assert.ok(html);
    });

    t.test("Cộng đồng: đăng (chặn từ thô tục), thích/lưu 2 chiều, sao chép tạo plan + đếm 1 lần/người", async ()=>{
      await J(`await TECommunity.load(true); return 1;`);
      const n0 = app.ev("TECommunity._C.list.length");
      assert.ok(n0 >= 21);
      const planId = app.ev("state.activePlanId");
      const bad = await errOf(`await cloud.social.publishRoutine(cloud.social.logic.routineFromPlan(state.plans[state.activePlanId], { title:"Giáo án vcl luôn", goal:"muscle" }))`);
      assert.equal(bad.code, "social/invalid"); assert.match(bad.message, /không phù hợp/);
      const short = await errOf(`await cloud.social.publishRoutine(cloud.social.logic.routineFromPlan(state.plans[state.activePlanId], { title:"ab" }))`);
      assert.match(short.message, /ít nhất 4 ký tự/);
      const doc = await J(`return await cloud.social.publishRoutine(cloud.social.logic.routineFromPlan(state.plans[state.activePlanId], { title:"Routine của Lan — mông đùi", desc:"Tập 3 buổi", goal:"glute", level:"beginner", gender:"nu", tags:["mông"] }))`);
      assert.equal(doc.authorName, "Lan Nguyễn"); assert.equal(doc.authorRole, "member"); assert.equal(doc.likes, 0);
      ctx.rid = doc.id;
      const l1 = await J(`return await cloud.social.toggleLike(${JSON.stringify(doc.id)})`);
      const l2 = await J(`return await cloud.social.toggleLike(${JSON.stringify(doc.id)})`);
      assert.deepEqual([l1.on, l1.count, l2.on, l2.count], [true, 1, false, 0]);
      const sv = await J(`return await cloud.social.toggleSave("seed-tpl-f-glute", true)`);
      assert.equal(sv.on, true);
      assert.ok((await J(`return await cloud.social.mySocial()`)).saved.includes("seed-tpl-f-glute"));
      // sao chép
      await J(`await TECommunity.load(true); return 1;`);
      const before = app.ev("Object.keys(state.plans).length"), cp0 = app.ev(`TECommunity._C.list.find(r=>r.id==="seed-tpl-f-glute").copies`);
      const res = await J(`const r = await TECommunity.copyRoutine("seed-tpl-f-glute", { setActive:true, videos:false }); return { id:r.plan.id, active:r.active }`);
      assert.equal(app.ev("Object.keys(state.plans).length"), before + 1);
      assert.equal(app.ev("state.activePlanId"), res.id);
      const p = app.evj(`state.plans[${JSON.stringify(res.id)}]`);
      assert.equal(p.fromRoutine, "seed-tpl-f-glute");
      assert.equal(p.days.T2.items[0].exerciseId, "hipthrust"); assert.equal(p.days.T2.items[0].sets, 4); assert.equal(p.days.CN.items.length, 0);
      assert.equal(app.ev(`TECommunity._C.list.find(r=>r.id==="seed-tpl-f-glute").copies`), cp0 + 1);
      await run(`await TECommunity.copyRoutine("seed-tpl-f-glute", { setActive:false, videos:false })`);
      assert.equal((await J(`return (await cloud.social.getRoutine("seed-tpl-f-glute")).copies`)), cp0 + 1, "1 người chỉ tính 1 lượt sao chép");
      assert.equal(app.ev("state.activePlanId"), res.id, "setActive:false giữ giáo án đang tập");
      await run(`state.activePlanId = ${JSON.stringify(planId)}; saveState();`);
    });

    t.test("Báo cáo vi phạm: ≥ 3 người báo cáo → tạm ẩn khỏi bảng tin (tác giả vẫn thấy ở 'Của tôi')", async ()=>{
      // fix-pt vòng 2 (QC-14): báo cáo tính theo trọng số — chỉ tài khoản ≥ 7 ngày tuổi được tính → cho 3 người báo cáo đủ tuổi
      await run(`const k = "fitkit_cloud_demo_v1", db = JSON.parse(localStorage.getItem(k) || "{}"); Object.values(db.users || {}).forEach(u=>{ if(["ha@mail.vn","minh@mail.vn","ke@mail.vn"].includes(u.email)) u.createdAt = Date.now() - 30*864e5; }); localStorage.setItem(k, JSON.stringify(db));`);
      for(const em of ["ha@mail.vn", "minh@mail.vn", "ke@mail.vn"]){
        await login(em);
        const r = await J(`return await cloud.social.reportRoutine(${JSON.stringify(ctx.rid)}, "Spam / quảng cáo")`);
        if(em === "ha@mail.vn"){ const again = await J(`return await cloud.social.reportRoutine(${JSON.stringify(ctx.rid)}, "Khác")`); assert.equal(again.already, true); assert.equal(again.reports, 1); }
        if(em === "ke@mail.vn"){ assert.equal(r.reports, 3); assert.equal(r.hidden, true); }
      }
      const vis = await J(`const all = await cloud.social.listRoutines(); return cloud.social.logic.filterRoutines(all, {}).some(r=> r.id === ${JSON.stringify(ctx.rid)})`);
      assert.equal(vis, false);
      await login("lan@mail.vn");
      const mine = await J(`const all = await cloud.social.listRoutines(); return cloud.social.logic.filterRoutines(all, { author: cloud.user.uid, includeHidden:true, viewer: cloud.user.uid }).map(r=> r.id)`);
      assert.ok(mine.includes(ctx.rid));
    });

    t.test("Tìm kiếm không dấu + lọc mục tiêu / cấp độ / giới tính / số buổi + sắp xếp", async ()=>{
      const r = await J(`const L = cloud.social.logic, all = await cloud.social.listRoutines();
        const ids = f=> L.filterRoutines(all, f).map(x=> x.id);
        return { mong: ids({ q:"mong" }), nu: ids({ gender:"nu" }), adv: ids({ level:"advanced" }), five: ids({ perWeek:"5+" }), endu: ids({ goal:"endurance" }),
          squat: ids({ q:"bulgaria" }), team: ids({ q:"tapeasy team ppl" }), sortCopies: L.sortRoutines(L.filterRoutines(all, {}), "copies").slice(0,3).map(x=> x.copies), home: ids({ equipment:"home" }) }`);
      assert.ok(r.mong.includes("seed-tpl-f-glute"), "tìm 'mong' (không dấu) ra routine mông");
      assert.ok(r.nu.includes("seed-tpl-f-fb") && r.nu.includes("seed-tpl-u-home") && !r.nu.includes("seed-tpl-m-fb"), "Nữ gồm cả routine Nam & Nữ, không gồm Nam");
      assert.ok(r.adv.length >= 4 && r.adv.every(id=> !/-fb$|home|cardio/.test(id)));
      assert.ok(r.five.includes("seed-tpl-m-ppl6") && !r.five.includes("seed-tpl-m-fb"));
      assert.ok(r.endu.includes("seed-tpl-u-hyrox") && r.endu.includes("seed-v-5k"));
      assert.ok(r.squat.length >= 3, "tìm theo tên bài tập");
      assert.ok(r.team.includes("seed-v-ppl3"));
      assert.ok(r.sortCopies[0] >= r.sortCopies[1] && r.sortCopies[1] >= r.sortCopies[2]);
      assert.ok(r.home.includes("seed-v-dbhome") && r.home.includes("seed-tpl-f-home"));
    });

    t.test("Kiểm duyệt: bắt từ thô tục (có dấu, teencode, tách chữ) nhưng không bắt nhầm từ thường", ()=>{
      const bad = ["đm thằng này", "v.c.l", "đụ má", "ĐỊT MẸ", "óc chó", "dcmmm", "fuck"];
      const ok = ["Buổi tập chân", "đeo đai lưng", "uống lon nước", "các bài kéo", "du lịch", "vòng eo 70 cm", "ngủ đủ giấc", "Đùi trước", "dịch vụ", "Cầu mông"];
      bad.forEach(s=> assert.ok(app.ev(`cloud.social.moderation.hasProfanity(${JSON.stringify(s)})`), "phải bắt: " + s));
      ok.forEach(s=> assert.ok(!app.ev(`cloud.social.moderation.hasProfanity(${JSON.stringify(s)})`), "bắt nhầm: " + s));
      assert.equal(app.ev(`cloud.social.moderation.cleanText("PT dạy hay đm")`), "PT dạy hay **");
    });

    t.test("Giao diện (HTML): thẻ routine, thẻ Trang chủ, tab PT của học viên, chi tiết không lỗi + escape nội dung", async ()=>{
      const card = await run(`const r = Object.assign({}, cloud.social.seeds[0], { id:"x", title:'<img src=x onerror=alert(1)>' }); return TECommunity.cardHTML(r);`);
      assert.ok(card.includes("&lt;img") && !card.includes("<img src=x"), "tiêu đề phải được escape");
      const home = app.ev("TECommunity.homeCardHTML()");
      assert.ok(home.includes("Cộng đồng TapEasy") && (home.match(/cm-home-mini/g) || []).length === 3);
      const hub = await run(`await refreshCoachData(true); return TEConnect.hubHTML();`);
      assert.ok(hub.includes("PT của bạn") && hub.includes('data-hub-tab="chat"') && hub.includes('data-hub-tab="progress"'));
      await run(`TECommunity.openDetail("seed-tpl-m-ul"); TECommunity.openShare();`);
      assert.ok(app.lastHtml("sheet-content").includes("Chọn giáo án để chia sẻ"));
      assert.deepEqual(app.asyncErrors.map(e=> String(e)), []);
    });

    t.test("Mã QR: phiên bản đúng theo độ dài, ma trận vuông, có 3 ô định vị", ()=>{
      const a = app.evj(`(()=>{ const r = TEConnect.QR.encode(TEConnect.joinUrl("K7M2QX")); return { ver:r.ver, size:r.size, tl:r.modules[0].slice(0,7), mid:r.modules[3].slice(0,7) }; })()`);
      assert.ok(a.ver >= 3 && a.ver <= 5, "phiên bản " + a.ver); assert.equal(a.size, a.ver*4 + 17);
      assert.deepEqual(a.tl, [true,true,true,true,true,true,true]); assert.deepEqual(a.mid, [true,false,true,true,true,false,true]);
      assert.ok(app.ev(`TEConnect.QR.svg("K7M2QX").startsWith("<svg")`));
    });
  },
};

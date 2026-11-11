/* Lớp dữ liệu online — động cơ DEMO (localStorage) của cloud.js: tài khoản, PT ↔ học viên, buổi tập, xoá tài khoản */
"use strict";
const { assert } = require("../lib/framework");

module.exports = {
  name: "Cloud demo: tài khoản & PT ↔ học viên",
  area: "Cloud (cloud.js — engine demo + API công khai)",
  async define(t){
    const app = await t.app();
    const J = async expr => { const v = await app.ev(expr); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
    const errOf = async expr => { try{ await app.ev(expr); return null; }catch(e){ return { message: e.message, code: e.code }; } };
    const db = ()=> JSON.parse(app.localStorage.getItem("fitkit_cloud_demo_v1") || "{}");
    const S = JSON.stringify;

    t.test("Chưa cấu hình Firebase → cloud.mode = 'demo', chưa đăng nhập", ()=>{
      assert.equal(app.ev("cloud.mode"), "demo");
      assert.equal(app.ev("cloud.isLoggedIn()"), false);
    });
    t.test("signUp: kiểm tra email/mật khẩu, thông báo lỗi tiếng Việt, chuẩn hoá email", async ()=>{
      assert.deepEqual(await errOf(`cloud.signUp("khong-phai-email", "123456", "A")`), { message:"Email không hợp lệ.", code:"auth/invalid-email" });
      assert.deepEqual(await errOf(`cloud.signUp("a@b.vn", "123", "A")`), { message:"Mật khẩu cần ít nhất 6 ký tự.", code:"auth/weak-password" });
      const u = await J(`cloud.signUp("  PT.Minh@Gym.VN ", "matkhau1", "PT Minh")`);
      assert.equal(u.email, "pt.minh@gym.vn"); assert.equal(u.name, "PT Minh");
      assert.equal(app.ev("cloud.profile.isPT"), false); assert.equal(app.ev("cloud.isLoggedIn()"), true);
      await app.ev("cloud.signOut()");
      assert.deepEqual(await errOf(`cloud.signUp("pt.minh@gym.vn", "khac123", "X")`), { message:"Email này đã được đăng ký.", code:"auth/email-already-in-use" });
      const u2 = await J(`cloud.signUp("hv.lan@mail.vn", "matkhau2")`);
      assert.equal(u2.name, "hv.lan", "tên mặc định lấy từ email");
      await app.ev("cloud.signOut()");
    });
    t.test("signIn: sai mật khẩu → 'Email hoặc mật khẩu không đúng.'; email không phân biệt hoa thường", async ()=>{
      assert.equal((await errOf(`cloud.signIn("pt.minh@gym.vn", "sai-mk")`)).message, "Email hoặc mật khẩu không đúng.");
      assert.equal((await errOf(`cloud.signIn("khongco@x.vn", "abcdef")`)).message, "Email hoặc mật khẩu không đúng.");
      const u = await J(`cloud.signIn("PT.MINH@gym.vn", "matkhau1")`);
      assert.equal(u.name, "PT Minh");
      assert.ok(!S(db()).includes("matkhau1"), "mật khẩu không được lưu dạng rõ");
    });
    t.test("Phiên đăng nhập được khôi phục khi mở lại app (cloud.init đọc DEMO_AUTH)", async ()=>{
      const a2 = await t.app({ storage: Object.fromEntries(app.localStorage._map) });
      await a2.ev("cloud.init()");
      assert.equal(a2.ev("cloud.user && cloud.user.email"), "pt.minh@gym.vn");
    });
    t.test("signInSocial demo: Google / Facebook / Apple tạo tài khoản riêng, đăng nhập lại giữ nguyên uid", async ()=>{
      await app.ev("cloud.signOut()");
      const names = {};
      for(const [fn, kind, label] of [["signInWithGoogle","google","Bạn (Google)"],["signInWithFacebook","facebook","Bạn (Facebook)"],["signInWithApple","apple","Bạn (Apple)"]]){
        const u = await J(`cloud.${fn}()`);
        assert.equal(u.email, `demo.${kind}@fitkit.local`); assert.equal(u.name, label);
        assert.equal(app.ev("cloud.profile.provider"), kind); assert.equal(app.ev("cloud.isSocialUser"), true);
        names[kind] = u.uid; await app.ev("cloud.signOut()");
      }
      assert.equal(new Set(Object.values(names)).size, 3);
      assert.equal((await J("cloud.signInWithGoogle()")).uid, names.google);
      await app.ev("cloud.signOut()");
    });
    let client, code;
    t.test("createClient: cần đăng nhập; gắn ptId/ptName(thương hiệu)/remindBefore; mã mời 8 ký tự không nhầm lẫn", async ()=>{
      assert.equal((await errOf(`cloud.createClient({ name:"X" })`)).message, "Chưa đăng nhập.");
      await app.ev(`cloud.signIn("pt.minh@gym.vn", "matkhau1")`);
      await app.ev(`cloud.updateMyProfile({ mainRole:"pt", isPT:true, brandName:"Minh Fitness" })`);
      client = await J(`cloud.createClient({ name:"Lan", goal:"Giảm mỡ", packageTotal:12, phone:"0900000000" })`);
      code = client.joinCode;
      // fix-security vòng 2 (QS-14): mã mới dài 8 (cloud.js JOIN_CODE_LEN) — mã 6 cũ vẫn nhận (test joinByCode bên dưới)
      assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
      assert.equal(client.ptId, app.ev("cloud.user.uid")); assert.equal(client.ptName, "Minh Fitness"); assert.equal(client.remindBefore, 60);
      assert.equal(client.studentUid, null);
      assert.deepEqual(db().joinCodes[code], { clientId: client.id, ptId: client.ptId });
      const list = await J("cloud.myClientsAsPT()"); assert.equal(list.length, 1);
    });
    t.test("joinByCode: chuẩn hoá mã (thường, gạch, khoảng trắng); báo lỗi sai độ dài / sai mã / mã của chính mình", async ()=>{
      assert.equal((await errOf(`cloud.joinByCode(${S(code)})`)).message, "Đây là mã do chính bạn tạo cho học viên.");
      await app.ev("cloud.signOut()");
      await app.ev(`cloud.signIn("hv.lan@mail.vn", "matkhau2")`);
      // fix-security (QS-14): máy chủ/rules nhận mã 6–10 ký tự (mã mới dài hơn chống dò) → thông báo đổi theo
      assert.equal((await errOf(`cloud.joinByCode("ABC")`)).message, "Mã gồm 6–10 ký tự chữ và số, ví dụ: K7M2QX.");
      assert.equal((await errOf(`cloud.joinByCode("ZZZZZZ")`)).message, "Mã không đúng hoặc đã bị xoá. Hỏi lại PT của bạn nhé.");
      const messy = " " + code.slice(0,3).toLowerCase() + "-" + code.slice(3) + " ";
      const c = await J(`cloud.joinByCode(${S(messy)})`);
      assert.equal(c.id, client.id); assert.equal(c.studentUid, app.ev("cloud.user.uid")); assert.equal(c.studentEmail, "hv.lan@mail.vn");
      const coaches = await J("cloud.myCoaches()"); assert.equal(coaches.length, 1); assert.equal(coaches[0].ptName, "Minh Fitness");
    });
    t.test("joinByCode: form ĐÃ có học viên → người thứ hai bị từ chối (không chiếm form)", async ()=>{
      const first = db().clients[client.id].studentUid;
      await app.ev("cloud.signOut()");
      await app.ev(`cloud.signUp("ke.la@mail.vn", "matkhau3", "Người lạ")`);
      const e = await errOf(`cloud.joinByCode(${S(code)})`);
      const now = db().clients[client.id].studentUid;
      await app.ev("cloud.signOut()");
      assert.ok(e, `Người lạ nhập lại mã đã dùng → thành công; studentUid đổi từ ${first} sang ${now} (học viên cũ mất form)`);
    }, { bug:"BUG-08", severity:"Trung bình" });
    t.test("saveSession / listSessions: tạo id + createdAt, cập nhật giữ trường cũ, sắp theo ngày-giờ", async ()=>{
      await app.ev(`cloud.signIn("pt.minh@gym.vn", "matkhau1")`);
      const cid = S(client.id);
      const a = await J(`cloud.saveSession(${cid}, { date:"2026-11-20", time:"18:00", title:"Chân", status:"scheduled", exercises:[{ name:"Squat", sets:4 }] })`);
      const b = await J(`cloud.saveSession(${cid}, { date:"2026-11-18", time:"07:30", title:"Ngực", status:"scheduled" })`);
      assert.ok(a.id && a.createdAt && a.updatedAt);
      await new Promise(r=> setTimeout(r, 5));
      const a2 = await J(`cloud.saveSession(${cid}, { id:${S(a.id)}, status:"done", feedback:"Ổn" })`);
      assert.equal(a2.title, "Chân"); assert.equal(a2.status, "done"); assert.equal(a2.createdAt, a.createdAt); assert.ok(a2.updatedAt >= a.updatedAt);
      assert.equal(a2.exercises[0].name, "Squat");
      const list = await J(`cloud.listSessions(${cid})`);
      assert.deepEqual(list.map(s=> s.id), [b.id, a.id]);
      await J(`cloud.addNote(${cid}, "Nhớ khởi động kỹ", "pt")`);
      const notes = await J(`cloud.listNotes(${cid})`);
      assert.equal(notes.length, 1); assert.equal(notes[0].authorRole, "pt"); assert.equal(notes[0].kind, "note");
    });
    t.test("updateClient: form không tồn tại → lỗi; deleteClient xoá cả mã mời, buổi tập, ghi chú", async ()=>{
      assert.ok(await errOf(`cloud.updateClient("khong-co", { name:"x" })`));
      const tmp = await J(`cloud.createClient({ name:"Tạm" })`);
      await app.ev(`cloud.saveSession(${S(tmp.id)}, { date:"2026-12-01", time:"08:00" })`);
      await app.ev(`cloud.deleteClient(${S(tmp.id)})`);
      const d = db();
      assert.equal(d.clients[tmp.id], undefined); assert.equal(d.joinCodes[tmp.joinCode], undefined); assert.equal(d.sessions[tmp.id], undefined);
    });
    t.test("deleteAccount (học viên, mật khẩu): sai mật khẩu → 'Sai mật khẩu.'; đúng → xoá tài khoản, gỡ khỏi form PT", async ()=>{
      await app.ev("cloud.signOut()");
      await app.ev(`cloud.signIn("ke.la@mail.vn", "matkhau3")`);
      const uid = app.ev("cloud.user.uid");
      assert.equal((await errOf(`cloud.deleteAccount("sai")`)).message, "Sai mật khẩu.");
      await app.ev(`cloud.deleteAccount("matkhau3")`);
      const d = db();
      assert.equal(app.ev("cloud.user"), null); assert.equal(d.users[uid], undefined); assert.equal(d.accounts["ke.la@mail.vn"], undefined);
      assert.ok(Object.values(d.clients).every(c=> c.studentUid !== uid));
      assert.equal((await errOf(`cloud.signIn("ke.la@mail.vn", "matkhau3")`)).message, "Email hoặc mật khẩu không đúng.");
      await app.ev(`cloud.signUp("ke.la@mail.vn", "matkhau9", "Đăng ký lại")`);   // email dùng lại được
      await app.ev("cloud.signOut()");
    });
    t.test("deleteAccount (PT): xoá mọi form của PT cùng mã mời, buổi tập, ghi chú; học viên không còn thấy PT", async ()=>{
      await app.ev(`cloud.signIn("pt.minh@gym.vn", "matkhau1")`);
      const ptUid = app.ev("cloud.user.uid");
      await app.ev(`cloud.deleteAccount("matkhau1")`);
      const d = db();
      assert.ok(Object.values(d.clients).every(c=> c.ptId !== ptUid));
      assert.ok(Object.values(d.joinCodes).every(j=> j.ptId !== ptUid));
      assert.equal(d.sessions[client.id], undefined); assert.equal(d.notes[client.id], undefined);
      await app.ev(`cloud.signIn("hv.lan@mail.vn", "matkhau2")`);
      assert.equal((await J("cloud.myCoaches()")).length, 0);
      await app.ev("cloud.signOut()");
    });
    t.test("deleteAccount (Google/Facebook/Apple): không cần mật khẩu", async ()=>{
      await app.ev("cloud.signInWithFacebook()");
      const uid = app.ev("cloud.user.uid");
      await app.ev(`cloud.deleteAccount("")`);
      assert.equal(db().users[uid], undefined);
    });
    t.test("deleteAccount khi CHƯA đăng nhập → báo lỗi tiếng Việt (không lộ TypeError)", async ()=>{
      await app.ev("cloud.signOut()");
      const e = await errOf(`cloud.deleteAccount("x")`);
      assert.ok(e, "không báo lỗi");
      assert.ok(!/Cannot read|undefined|null/.test(e.message), `thông báo: "${e.message}"`);
    }, { bug:"BUG-16", severity:"Thấp" });
    t.test("leaveCoach: học viên rời PT → studentUid/Name/Email = null", async ()=>{
      await app.ev(`cloud.signIn("hv.lan@mail.vn", "matkhau2")`);
      await app.ev(`cloud.updateMyProfile({ mainRole:"pt", isPT:true })`);
      const c = await J(`cloud.createClient({ name:"HV2" })`);
      await app.ev("cloud.signOut()"); await app.ev("cloud.signInWithGoogle()");
      await app.ev(`cloud.joinByCode(${S(c.joinCode)})`);
      await app.ev(`cloud.leaveCoach(${S(c.id)})`);
      const x = db().clients[c.id];
      assert.equal(x.studentUid, null); assert.equal(x.studentName, null); assert.equal(x.studentEmail, null);
      await app.ev("cloud.signOut()");
    });
    t.test("onAuth listener được gọi khi đăng nhập/đăng xuất", async ()=>{
      app.run("globalThis.__authCalls = []; cloud.onAuth((u)=> __authCalls.push(u ? u.email : null));");
      await app.ev(`cloud.signIn("hv.lan@mail.vn", "matkhau2")`); await app.ev("cloud.signOut()");
      assert.deepEqual(app.evj("__authCalls"), ["hv.lan@mail.vn", null]);
    });
  },
};

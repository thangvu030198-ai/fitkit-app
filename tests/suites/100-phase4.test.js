/* 19/11/2026 — GĐ4: bản đồ phục hồi cơ (recovery.js), nút YouTube (guide-links.js), giãn cơ hẹn giờ (stretch.js) */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
const read = f=> fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
module.exports = {
  name: "GĐ4: phục hồi cơ · video YouTube · giãn cơ",
  area: "recovery.js / guide-links.js / stretch.js",
  async define(t){
    const app = await t.app();
    t.test("P4-01: phục hồi — vừa tập nặng = mỏi, hồi theo giờ, cơ lớn lâu hơn cơ nhỏ, ngoài 5 ngày bỏ qua", ()=>{
      const H = 3600000, now = 1795000000000;
      const r = app.evj(`FKRecovery.compute([{ endedAt: ${now - 2*H}, exercises:[{ key:"c:x", muscle:"Ngực", sets:6 }, { key:"c:y", muscle:"Tay sau", sets:6 }] }], ${now})`);
      assert.ok(r.groups["Ngực"].f >= 0.9, "vừa tập 6 hiệp → gần mỏi hẳn");
      const r2 = app.evj(`FKRecovery.compute([{ endedAt: ${now - 40*H}, exercises:[{ key:"c:x", muscle:"Ngực", sets:6 }, { key:"c:y", muscle:"Tay sau", sets:6 }] }], ${now})`);
      assert.ok(r2.groups["Ngực"].f > r2.groups["Tay sau"].f, "cơ lớn hồi chậm hơn");
      assert.ok(r2.groups["Tay sau"].f < 0.25, "cơ nhỏ sau 40 giờ đã gần hồi");
      const r3 = app.evj(`FKRecovery.compute([{ endedAt: ${now - 6*24*H}, exercises:[{ key:"c:x", muscle:"Ngực", sets:6 }] }], ${now})`);
      assert.equal(r3.sessions, 0);
      assert.equal(app.ev(`FKRecovery.statusOf(0.7).k`), "tired"); assert.equal(app.ev(`FKRecovery.statusOf(0.1).k`), "ready");
      assert.ok(/<svg/.test(app.ev(`FKRecovery.mapSVG(FKRecovery.compute([], ${now}))`)));
    });
    t.test("P4-02: YouTube — chỉ link tìm kiếm, ưu tiên tên tiếng Anh trong ngoặc, chặn link lạ", ()=>{
      assert.equal(app.ev(`FKYT.query("Đẩy ngực máy (Machine Chest Press)")`), "Machine Chest Press proper form");
      assert.equal(app.ev(`FKYT.query("Hít đất")`), "Hít đất kỹ thuật đúng");
      assert.ok(/^https:\/\/www\.youtube\.com\/results\?search_query=/.test(app.ev(`FKYT.url("Plank")`)));
      assert.equal(app.ev(`FKYT.open("https://evil.example/x")`), false);
      assert.ok(/data-yt="https:\/\/www\.youtube\.com/.test(app.ev(`FKYT.button("Squat")`)));
      assert.ok(/FKYT\.button\(x\.name\)/.test(read("library.js")));
    });
    t.test("P4-03: giãn cơ — chọn theo nhóm cơ, bài 2 bên tính gấp đôi, bài nằm/quỳ xếp cuối, toàn thân phủ đủ 10 nhóm", ()=>{
      const p = app.evj(`FKStretch.plan(["Đùi trước","Mông","Đùi sau"])`);
      assert.ok(p.list.length >= 3 && p.list.every(x=> x.g.some(g=> ["Đùi trước","Mông","Đùi sau","Bắp chân","Lưng"].includes(g))));
      assert.equal(p.sec, p.list.reduce((a, x)=> a + (x.two ? 60 : 30), 0));
      const all = app.evj(`FKStretch.plan([])`);
      const cov = new Set(); all.list.forEach(x=> x.g.forEach(g=> cov.add(g))); assert.equal(cov.size, 10);
      const floor = ["child","cat-cow","cobra","hip-flexor","ham-seat","fig4"], ids = all.list.map(x=> x.id);
      const firstFloor = ids.findIndex(i=> floor.includes(i)); assert.ok(ids.slice(firstFloor).every(i=> floor.includes(i)));
    });
    t.test("P4-04: 3 file nạp sau app.js, có trong cache offline + bản store", ()=>{
      const idx = read("index.html"), sw = read("sw.js"), pw = read("scripts/prepare-www.sh");
      ["recovery.js", "guide-links.js", "stretch.js"].forEach(f=>{ assert.ok(idx.indexOf(f) > idx.indexOf("training-pro.js"), f); assert.ok(sw.includes("./" + f) && pw.includes(f), f); });
    });
  }
};

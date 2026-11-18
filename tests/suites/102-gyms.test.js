/* 19/11/2026 — Nhiều phòng tập (gyms.js) */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
const read = f=> fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
module.exports = {
  name: "Nhiều phòng tập: nấc tạ / đĩa / thanh đòn theo phòng đang chọn",
  area: "gyms.js",
  async define(t){
    const app = await t.app();
    t.test("GYM-01: chưa có phòng → giữ nấc mặc định của app", ()=>{
      app.run(`state.gyms = { list: [], active: null }`);
      assert.equal(app.ev(`FKGyms.active()`), null);
      assert.equal(app.ev(`weightStep({ equipment: "Thanh đòn" })`), 2.5);
      assert.equal(app.ev(`weightStep({ equipment: "Tạ đơn" })`), 2);
    });
    t.test("GYM-02: chọn phòng → thanh đòn = 2 × đĩa nhỏ nhất, tạ đơn / máy / cáp theo phòng", ()=>{
      app.run(`state.gyms = { list: [{ id:"g1", name:"Gym nhà", bar:15, minPlate:2.5, maxPlate:20, db:2.5, machine:10, cable:5 }], active:"g1" }`);
      assert.equal(app.ev(`weightStep({ equipment: "Thanh đòn" })`), 5);
      assert.equal(app.ev(`weightStep({ equipment: "Tạ đơn" }, 20)`), 2.5);
      assert.equal(app.ev(`weightStep({ equipment: "Tạ đơn" }, 8)`), 1);
      assert.equal(app.ev(`weightStep({ equipment: "Máy" }, 50)`), 10);
      assert.equal(app.ev(`weightStep({ name: "Kéo cáp", equipment: "Cáp" }, 30)`), 5);
      const ph = app.ev(`plateHTML(60)`).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      assert.ok(/thanh 15 kg/.test(ph) && /Mỗi bên 20 \+ 2,5/.test(ph), ph);
      app.run(`state.gyms = { list: [], active: null }`);
    });
    t.test("GYM-03: dữ liệu phòng bị sửa tay → làm sạch (giá trị ngoài danh sách về mặc định, tên không có HTML)", ()=>{
      const g = app.evj(`FKGyms.clean({ name: "<b>X</b>", bar: 99, minPlate: "abc", db: 2.5 })`);
      assert.equal(g.bar, 20); assert.equal(g.minPlate, 1.25); assert.equal(g.db, 2.5); assert.ok(!/[<>]/.test(g.name));
      assert.ok(read("index.html").indexOf("gyms.js") > read("index.html").indexOf("coach-tips.js"));
      assert.ok(/gyms\.js/.test(read("sw.js")) && /gyms\.js/.test(read("scripts/prepare-www.sh")));
    });
  }
};

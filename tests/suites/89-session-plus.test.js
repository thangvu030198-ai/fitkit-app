/* 16/11/2026 — session-plus.js: loại hiệp (khởi động / drop / tới hạn), "lần trước" từng hiệp, thêm/xoá hiệp, kỷ lục tức thì, đổi thứ tự bài */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
function load(){
  const W = {}; W.window = W;
  new Function("window", read("session-plus.js").replace('typeof window !== "undefined" ? window : globalThis', "window"))(W);
  return W.FKSessionPlus;
}
module.exports = {
  name: "Ghi buổi tập nâng cao: loại hiệp · lần trước từng hiệp · kỷ lục tức thì",
  area: "session-plus.js, app.js (recordExerciseResult), training-pro.js, index.html, sw.js",
  async define(t){
    const P = load();
    const app = await t.app();
    const C = (fn, ...a)=> app.call(fn, ...a);

    t.test("SP-01: nhãn hiệp — khởi động/drop hiện chữ, hiệp chính đánh số riêng", ()=>{
      const rows = [{type:"w"},{type:"w"},{},{},{type:"d"},{type:"f"}];
      assert.deepEqual(rows.map((_, i)=> P.label(rows, i)), ["W","W","1","2","D","3F"]);
      assert.equal(P.label([{type:"xyz"}], 0), "1", "loại lạ coi như hiệp thường");
    });
    t.test("SP-02: 'lần trước' khớp đúng hiệp cùng loại", ()=>{
      const last = { sets:[{kg:60,reps:8},{kg:60,reps:7}], all:[{t:"w",kg:30,reps:10},{t:"",kg:60,reps:8},{t:"",kg:60,reps:7},{t:"d",kg:40,reps:12}] };
      const rows = [{type:"w"},{},{},{type:"d"},{}];
      assert.deepEqual(P.prevFor(last, rows, 0), {kg:30,reps:10});
      assert.deepEqual(P.prevFor(last, rows, 1), {kg:60,reps:8});
      assert.deepEqual(P.prevFor(last, rows, 2), {kg:60,reps:7});
      assert.deepEqual(P.prevFor(last, rows, 3), {kg:40,reps:12});
      assert.equal(P.prevFor(last, rows, 4), null, "hiệp thêm mới chưa có lần trước");
      assert.equal(P.prevFor(null, rows, 0), null);
    });
    t.test("SP-03: dựng lại cấu trúc buổi trước (khởi động lên đầu, drop xuống cuối), không vượt 20 hiệp, không dựng 2 lần", ()=>{
      const last = { sets:[{kg:60,reps:8}], all:[{t:"w",kg:30,reps:10},{t:"",kg:60,reps:8},{t:"d",kg:40,reps:12}] };
      const rows = [{kg:60,reps:8,done:false},{kg:60,reps:8,done:false}];
      assert.equal(P.rebuild(rows, last), true);
      assert.deepEqual(rows.map(r=> r.type || ""), ["w","","","d"]);
      assert.equal(rows[0].kg, 30); assert.equal(rows[3].reps, 12);
      assert.equal(P.rebuild(rows, last), false, "đã có loại hiệp → không dựng lại");
      const full = Array.from({length:20}, ()=> ({kg:1,reps:1}));
      assert.equal(P.rebuild(full, last), false); assert.equal(full.length, 20);
      assert.equal(P.rebuild([{kg:1}], { sets:[] }), false);
    });
    t.test("SP-04: kỷ lục tức thì — chỉ khi vượt mức cũ > 0,4 kg và vượt mức đã báo trong buổi", ()=>{
      const h = { list:[{ e1rm:80 },{ e1rm:76 }] };
      assert.equal(P.prCheck(h, 60, 8, 0), 0, "60×8 = 76 < 80");
      assert.ok(P.prCheck(h, 65, 8, 0) > 82);
      assert.equal(P.prCheck(h, 65, 8, 82.4), 0, "đã báo mức này rồi");
      assert.equal(P.prCheck({ list:[] }, 100, 5, 0), 0, "buổi đầu chưa có mốc so sánh → không báo");
      assert.equal(P.prCheck(h, 0, 20, 0), 0);
    });
    t.test("SP-05: đổi thứ tự bài · thêm hiệp · số liệu trực tiếp bỏ hiệp khởi động", ()=>{
      const items = ["a","b","c","d"]; assert.ok(P.moveItem(items, 3, 1)); assert.deepEqual(items, ["a","d","b","c"]);
      assert.ok(P.moveItem(items, 1, 3)); assert.deepEqual(items, ["a","b","c","d"]);
      assert.equal(P.moveItem(items, 2, 2), false); assert.equal(P.moveItem(items, 9, 0), false);
      const rows = [{kg:30,reps:10,type:"w",done:true},{kg:60,reps:8,done:true}];
      assert.ok(P.addRow(rows)); assert.equal(rows[2].kg, 60); assert.equal(rows[2].done, false); assert.ok(!rows[2].type);
      const big = Array.from({length:20}, ()=> ({})); assert.equal(P.addRow(big), false);
      assert.deepEqual(P.stats({ sets:{ u1: rows, u2:[{kg:40,reps:10,done:true,type:"d"},{kg:40,reps:10,done:false}] } }), { sets:2, vol:880 });
    });
    t.test("SP-06: chênh lệch so với lần trước", ()=>{
      const p = { kg:60, reps:8 };
      assert.equal(P.delta(p, 62.5, 8), "+2,5 kg".replace(",", P.delta(p, 62.5, 8).includes(",") ? "," : "."));
      assert.equal(P.delta(p, 60, 9), "+1 lần"); assert.equal(P.delta(p, 60, 8), "="); assert.equal(P.delta(p, 60, 6), "−2 lần");
      assert.ok(P.delta(p, 55, 10).startsWith("−5")); assert.equal(P.delta(p, 60, ""), ""); assert.equal(P.delta(null, 60, 8), "");
    });

    t.test("SP-10: lưu bài có khởi động + drop — khởi động KHÔNG vào lịch sử/kỷ lục; drop vào khối lượng nhưng không xét tăng tạ", ()=>{
      app.run("state.setLog = {}; state.setHist = {};");
      app.setNow("2026-05-04T09:00");
      C("recordExerciseResult", "benchpress", "Bench", "6-8", [{kg:100,reps:5,type:"w"},{kg:60,reps:8},{kg:60,reps:8},{kg:60,reps:8},{kg:40,reps:15,type:"d"}], false);
      const log = app.evj("state.setLog.benchpress"), h = app.evj("state.setHist.benchpress");
      assert.deepEqual(log.sets.map(s=> [s.kg, s.reps]), [[60,8],[60,8],[60,8]], "setLog.sets chỉ còn hiệp chính");
      assert.equal(log.fails, 0, "drop 15 lần / khởi động 5 lần không làm sai đánh giá đạt-trượt");
      assert.deepEqual(log.all.map(s=> s.t), ["w","","","","d"]);
      const e = h.list[0];
      assert.equal(e.sets.length, 4, "lịch sử: 3 hiệp chính + 1 drop");
      assert.equal(e.vol, 60*8*3 + 40*15);
      assert.equal(e.top, 60, "tạ khởi động 100 kg không thành 'mức tạ cao nhất'");
      assert.equal(e.e1rm, 76, "e1RM từ hiệp chính, không từ khởi động 100×5");
      assert.equal(e.sets[3].t, "d");
    });
    t.test("SP-11: buổi sau — gợi ý tăng tạ dựa trên hiệp chính của buổi trước", ()=>{
      app.setNow("2026-05-07T09:00");
      const meta = { name:"Bench", equipment:"Thanh đòn" };
      const p = C("progressionFor", { reps:"6-8", exerciseId:"benchpress" }, meta, app.ev("state.setLog.benchpress"), false, 3);
      assert.ok(p.delta > 0 && p.kg > 60 && p.kg < 70, "đạt 8-8-8 ở 60 kg → tăng nhẹ, không nhảy theo 100 kg khởi động: " + JSON.stringify(p));
    });
    t.test("SP-12: chỉ toàn hiệp khởi động → vẫn lưu như hiệp thường (không mất dữ liệu); không loại → không tạo 'all'", ()=>{
      app.run("state.setLog = {}; state.setHist = {};");
      C("recordExerciseResult", "squat", "Squat", "6-8", [{kg:40,reps:8,type:"w"},{kg:40,reps:8,type:"w"}], false);
      assert.equal(app.evj("state.setLog.squat").sets.length, 2);
      assert.equal(app.evj("state.setHist.squat").list[0].sets.length, 2);
      C("recordExerciseResult", "row", "Row", "6-8", [{kg:40,reps:8},{kg:40,reps:8,type:"lạ"}], false);
      const r = app.evj("state.setLog.row"); assert.ok(!r.all); assert.ok(r.sets.every(s=> !s.type));
    });
    t.test("SP-20: đã nối vào app — index.html (sau training-pro), sw.js, prepare-www.sh; nút lưu truyền loại hiệp", ()=>{
      const html = read("index.html");
      assert.ok(html.indexOf("session-plus.js") > html.indexOf("training-pro.js"));
      assert.ok(/"\.\/session-plus\.js"/.test(read("sw.js")));
      assert.ok(/session-plus\.js/.test(read("scripts/prepare-www.sh")));
      assert.ok(/type: r\.type \|\| undefined/.test(read("app.js")) && /type: r\.type \|\| undefined/.test(read("training-pro.js")));
      const src = read("session-plus.js");
      assert.ok(!/innerHTML\s*=\s*[^;]*\bnote\.value/.test(src), "ghi chú người dùng không chèn thẳng vào HTML");
      assert.ok(!/hevy/i.test(src));
    });
  }
};

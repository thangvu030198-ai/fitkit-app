/* 19/11/2026 — góp ý người dùng: sửa bài đã xong / nhật ký, Buổi hôm nay, AI đọc nhật ký, gợi ý ngày mai */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
const read = f=> fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
module.exports = {
  name: "Góp ý người dùng: sửa ghi sai, xem lại buổi, AI đọc nhật ký, gợi ý ngày mai",
  area: "session-review.js / coach-tips.js / ai-coach.js / session-focus.js",
  async define(t){
    const app = await t.app();
    t.test("UF-01: tính lại 1RM / tạ nặng nhất / khối lượng sau khi sửa (gộp nhiều phần trong ngày)", ()=>{
      const r = app.evj(`FKReview.recompute({ parts:{ a:[{kg:60,reps:10}], b:[{kg:70,reps:5}] } })`);
      assert.equal(r.top, 70); assert.equal(r.vol, 950); assert.equal(r.sets.length, 2); assert.ok(r.e1rm > 80);
    });
    t.test("UF-02: bài đã xong mở lại được để sửa; Lưu sửa quay về bài đang tập (không đếm trùng)", ()=>{
      const s = read("session-review.js");
      assert.ok(/data-rv-edit/.test(s) && /s\._edit = \{ ret: s\.idx \}/.test(s) && /s\.idx = ret/.test(s) && /indexOf\(u\) === i/.test(s));
      assert.ok(/Lưu sửa — quay lại bài đang tập/.test(s) && /Buổi hôm nay/.test(s) && /Chi tiết \/ sửa/.test(s));
    });
    t.test("UF-03: thanh hiệp có hoàn tác, thu gọn (nhớ lựa chọn), lịch sử nhanh 5 buổi", ()=>{
      const s = read("session-focus.js");
      assert.ok(/data-sf-undo/.test(s) && /fk_focus_min/.test(s) && /slice\(-5\)/.test(s) && /data-sf-hist/.test(s));
    });
    t.test("UF-04: AI nhận nhật ký chi tiết (kg×lần@RPE), phục hồi, giấc ngủ, InBody — có giới hạn độ dài", ()=>{
      const s = read("ai-coach.js");
      assert.ok(/function trainingLogText/.test(s) && /NHẬT KÝ TẬP 10 BUỔI/.test(s) && /slice\(0, 3800\)/.test(s) && /lines\.push\(t\)/.test(s));
      assert.equal(typeof app.ev(`FKCoach.trainingLogText()`), "string");
    });
    t.test("UF-05: gợi ý ngày mai — thiếu ngủ / nhiều ngày liền → khuyên giảm; thông báo chỉ khi người dùng bật", ()=>{
      const tip = app.evj(`(function(){ const d = new Date(); d.setHours(12); return FKTips.build(d); })()`);
      assert.ok(Array.isArray(tip.tips) && tip.tips.length >= 1);
      const s = read("coach-tips.js");
      assert.ok(/if\(!c\.notify\) return false/.test(s) && /requestPermissions/.test(s) && /ID_MORNING = 960/.test(s));
      assert.ok(/!\(t\.sleep && t\.sleep\.debt\)/.test(s), "thiếu ngủ thì không gợi ý tăng tạ");
    });
    t.test("UF-06: nạp đúng thứ tự + có trong cache offline / bản store", ()=>{
      const idx = read("index.html"), sw = read("sw.js"), pw = read("scripts/prepare-www.sh");
      ["session-review.js", "coach-tips.js"].forEach(f=>{ assert.ok(idx.indexOf(f) > idx.indexOf("session-focus.js"), f); assert.ok(sw.includes("./" + f) && pw.includes(f), f); });
    });
  }
};

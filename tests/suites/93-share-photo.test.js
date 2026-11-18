/* 18/11/2026 — Thẻ chia sẻ kiểu "Ảnh của bạn" (training-pro.js): thêm chế độ ảnh + số liệu, GIỮ thẻ số liệu cũ */
"use strict";
const { assert } = require("../lib/framework");
module.exports = {
  name: "Thẻ chia sẻ: ảnh của bạn + số liệu (giữ thẻ số liệu cũ)",
  area: "training-pro.js",
  async define(t){
    const app = await t.app();
    const SUM = `{ date:"2026-11-18", title:"Ngực & Tay sau", dur:4291, volume:5355, sets:25, completed:7, total:7, prs:[{name:"Bench",text:"80 kg × 6"}], exercises:[] }`;
    t.test("PHOTO-01: số liệu đè ảnh lấy đúng từ buổi tập; buổi không tạ không hiện khối lượng", ()=>{
      const s = app.evj(`FKTP.photoStats(${SUM})`);
      assert.equal(s.dur, "1:11:31"); assert.equal(s.vol, "5.355"); assert.equal(s.sets, "25"); assert.equal(s.ex, "7/7"); assert.equal(s.prs, 1);
      const z = app.evj(`FKTP.photoStats({ dur: 600, sets: 3, completed: 1, total: 2 })`);
      assert.equal(z.vol, ""); assert.equal(z.prs, 0); assert.equal(z.title, "Buổi tập");
      assert.deepEqual(app.evj(`FKTP.PHOTO_TPLS.map(x=> x[0])`), ["full", "big", "bar", "min"]);
    });
    t.test("PHOTO-04: thêm thông tin — số lần, kcal ước tính, nhóm cơ, bài nổi bật (kèm hiệp tốt nhất), kế hoạch/tuần", ()=>{
      const s = app.evj(`FKTP.photoStats({ dur: 3600, volume: 4000, sets: 12, reps: 120, completed: 3, total: 3, planName: "PPL", week: 2, weeks: 8,
        prs: [{ name: "Bench (BB)", text: "80 kg × 6" }],
        exercises: [{ key: "benchpress", name: "Bench (BB)", muscle: "Ngực / Tay sau", sets: 4, vol: 2000, best: { kg: 80, reps: 6 } },
                    { key: "tricepsdown", name: "Pushdown", muscle: "Tay sau", sets: 3, vol: 600, best: { kg: 22.5, reps: 12 } }] })`);
      assert.equal(s.reps, "120"); assert.equal(s.plan, "PPL"); assert.equal(s.week, "Tuần 2/8");
      assert.equal(s.top[0].name, "Bench"); assert.equal(s.top[0].best, "80 kg × 6"); assert.equal(s.top[1].best, "22,5 kg × 12");
      assert.equal(s.prList[0].name, "Bench");
      assert.ok(s.muscles.length >= 1 && s.muscles.some(m=> m[0] === "Tay sau"));
      assert.equal(app.ev(`FKTP.estKcal(3600, 70)`), 350, "MET 5 × 70 kg × 1 giờ");
      assert.equal(app.ev(`FKTP.estKcal(3600, 0)`), 0, "không có cân nặng → không bịa kcal");
    });
    t.test("PHOTO-02: tờ chia sẻ có 2 kiểu — 'Thẻ số liệu' mặc định (cũ) và 'Ảnh của bạn' (mới); vẫn đủ Lưu ảnh / Chia sẻ", ()=>{
      app.run(`FKTP.openShareCard(${SUM})`);
      const h = app.lastHtml("sheet-content");
      assert.ok(/data-sc-mode="stats"[^>]*aria-selected="true"/.test(h), "thẻ số liệu là mặc định");
      assert.ok(/data-sc-mode="photo"/.test(h) && /id="tp-sc-photo"[^>]*hidden/.test(h), "khối ảnh ẩn cho tới khi chọn");
      assert.ok(/id="tp-sc-file"[^>]*accept="image\/\*"/.test(h) && /id="tp-sc-cam"[^>]*capture=/.test(h));
      assert.ok(/data-sc-tpl="full"/.test(h) && /data-sc-tpl="big"/.test(h) && /data-sc-tpl="bar"/.test(h) && /data-sc-tpl="min"/.test(h));
      assert.ok(/data-sc-ratio="4:5"/.test(h) && /data-sc-ratio="9:16"/.test(h));
      assert.ok(/id="tp-sc-save"/.test(h) && /id="tp-sc-share"/.test(h) && /tp-share-canvas/.test(h));
    });
    t.test("PHOTO-03: ảnh chỉ xử lý trên máy — không có lệnh tải ảnh lên máy chủ trong phần thẻ ảnh", ()=>{
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "training-pro.js"), "utf8");
      const a = src.indexOf("function drawPhotoCard"), b = src.indexOf("function shareText");
      const part = src.slice(a, b);
      assert.ok(a > 0 && b > a);
      assert.ok(!/fetch\(|XMLHttpRequest|uploadBytes|putString|cloud\./.test(part));
      assert.ok(/typeof drawShareCard|function drawShareCard/.test(src), "hàm vẽ thẻ số liệu cũ còn nguyên");
    });
  }
};

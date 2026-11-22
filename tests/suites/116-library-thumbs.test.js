/* 22/11/2026 — Anh Thắng: "ảnh bìa trong thư viện đang bị trùng nhau rất nhiều, check cho ảnh minh hoạ chuẩn vào".
   Thư viện → Đùi trước: Leg Extension, Leg Press, Back Squat, Lunge, Calf Raise, Hack/Smith/Goblet/Front Squat, Bulgarian… cùng 1 ảnh
   (IMG.muscle_legs → ảnh AI cô gái goblet squat). Nay fkThumb (exdb.js): khung 3D của chính bài → ảnh free-exercise-db của chính bài →
   ô minh hoạ trung tính (icon dụng cụ, không có người). */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
const SHOT = ["legext", "legpress", "squat", "lunges", "calfraise", "hacksquat", "smithsquat", "gobletsquat", "frontsquat", "bulgarian"];
module.exports = {
  name: "Ảnh bìa đúng từng bài trong Thư viện / giáo án / màn tập (fkThumb)",
  area: "exdb.js, library.js, exdb-vi.js, app.js, assets/ex-thumbs, scripts/thumb-audit.js",
  async define(t){
    const app = await t.app({ state:{ onboarded:true, authDone:true } });

    t.test("LT-01: 10 bài trong ảnh chụp (Đùi trước) — mỗi bài 1 ảnh khác nhau, đúng nguồn, không còn ảnh nhóm cơ", ()=>{
      const r = app.evj(`(${JSON.stringify(SHOT)}).map(k=> Object.assign({ k, img: EXERCISES[k].img, old: EXERCISES[k]._groupImg }, fkThumb.forKey(k)))`);
      const srcs = r.map(x=> x.src);
      assert.equal(new Set(srcs).size, SHOT.length, "ảnh trùng: " + JSON.stringify(srcs));
      r.forEach(x=>{
        assert.equal(x.img, x.src, x.k + ": EXERCISES.img chưa đổi");
        assert.ok(!/pexels|people-ai/.test(x.img), x.k + " vẫn dùng ảnh nhóm cơ: " + x.img);
        assert.ok(/pexels|people-ai/.test(x.old || ""), x.k + ": phải giữ ảnh cũ ở _groupImg");
      });
      const by = Object.fromEntries(r.map(x=> [x.k, x]));
      const want3d = { legext:"lever-leg-extension", legpress:"sled-45-degree-leg-wide-press", squat:"classic-barbell-squat", lunges:"dumbbell-lunge",
        hacksquat:"sled-hack-squat", smithsquat:"smith-chair-squat", gobletsquat:"dumbbell-goblet-squat", frontsquat:"barbell-front-chest-squat" };
      for(const [k, slug] of Object.entries(want3d)){
        assert.equal(by[k].kind, "ex3d", k);
        assert.equal(by[k].src, "https://tapeasy.app/media/ex3d/" + slug + ".jpg", k);
        assert.ok(fs.existsSync(path.join(ROOT, "media/ex3d", slug + ".jpg")), "thiếu poster " + slug);
      }
      assert.equal(by.calfraise.kind, "exdb");
      assert.ok(/free-exercise-db\/main\/exercises\/Standing_Calf_Raises\/0\.jpg$/.test(by.calfraise.src), by.calfraise.src);
      assert.equal(by.bulgarian.kind, "neutral", "Bulgarian chưa có ảnh đúng → ô trung tính, KHÔNG mượn ảnh squat khác");
      assert.equal(by.bulgarian.src, "assets/ex-thumbs/dumbbell.svg");
      assert.equal(by.bulgarian.abbr, "BSS");
    });

    t.test("LT-02: mọi nhóm cơ của thư viện — không 2 bài chuẩn khác nhau dùng chung 1 ảnh người tập; mọi bài có trong bảng ánh xạ", ()=>{
      const r = app.evj(`(()=>{
        const items = libBuiltinItems(), out = {}, miss = Object.keys(EXERCISES).filter(k=> !(k in fkThumb.MAP));
        MUSCLE_GROUPS_UI.forEach(g=>{ const seen = {}; items.filter(x=> x.groups.includes(g.id)).forEach(x=>{ const t = fkThumbForLib(x);
          if(t.kind === "neutral") return; (seen[t.src] = seen[t.src] || []).push(x.id); });
          Object.entries(seen).forEach(([s, ks])=>{ if(ks.length > 1) out[g.id + " " + s] = ks; }); });
        return { dup: out, miss, n: items.length, people: items.filter(x=> /pexels|people-ai/.test(x.img)).map(x=> x.id) };
      })()`);
      assert.ok(r.n >= 60, "số bài chuẩn " + r.n);
      assert.deepEqual(r.dup, {}, "trùng ảnh trong nhóm: " + JSON.stringify(r.dup));
      assert.deepEqual(r.miss, [], "bài chưa có trong FK_THUMB_EXDB");
      assert.deepEqual(r.people, [], "còn ảnh người chung nhóm cơ");
    });

    t.test("LT-03: bảng 3D khớp media/ex3d/index.json; id exdb tồn tại; thumb-audit chạy 0 lỗi", ()=>{
      const idx = JSON.parse(read("media/ex3d/index.json"));
      const want = {}; idx.forEach(x=>{ if((x.ids || []).length) want[x.slug] = x.ids; });
      assert.deepEqual(app.evj("fkThumb.EX3D"), want, "FK_EX3D_SLUGS lệch index.json");
      const A = require(path.join(ROOT, "scripts/thumb-audit.js"));
      const res = A.audit(A.load());
      assert.deepEqual(res.errors, [], res.errors.join("\n"));
      assert.ok(res.summary.ex3d >= 20 && res.summary.exdb >= 30 && res.summary.neutral <= 10, JSON.stringify(res.summary));
    });

    t.test("LT-04: bài free-exercise-db — clip 3D chính của bài → khung 3D; trùng id bài chuẩn → ảnh khác (khung 1), không lặp y hệt", ()=>{
      const r = app.evj(`({
        curl: fkThumbForExdb({ id:"Barbell_Curl", images:["Barbell_Curl/0.jpg","Barbell_Curl/1.jpg"] }),
        sq: fkThumbForExdb({ id:"Barbell_Squat", images:["Barbell_Squat/0.jpg","Barbell_Squat/1.jpg"] }),
        dl: fkThumbForExdb({ id:"Barbell_Deadlift", images:["Barbell_Deadlift/0.jpg","Barbell_Deadlift/1.jpg"] }),
        one: fkThumbForExdb({ id:"Barbell_Deadlift", images:["Barbell_Deadlift/0.jpg"] }),
        zer: fkThumbForExdb({ id:"Zercher_Squat", images:["Zercher_Squat/0.jpg","Zercher_Squat/1.jpg"] }),
        none: fkThumbForExdb({ id:"X", name:"Odd Thing", equipment:"bands", images:[] }),
        dl0: fkThumb.forKey("deadlift").src, sq0: fkThumb.forKey("squat").src })`);
      assert.equal(r.curl.kind, "ex3d"); assert.ok(/ex3d\/barbell-curl\.jpg$/.test(r.curl.src));
      assert.equal(r.sq.kind, "exdb", "khung 3D squat đã thuộc bài chuẩn Gánh tạ → bài exdb dùng ảnh riêng");
      assert.ok(/Barbell_Squat\/0\.jpg$/.test(r.sq.src) && r.sq.src !== r.sq0);
      assert.ok(/Barbell_Deadlift\/1\.jpg$/.test(r.dl.src) && r.dl.src !== r.dl0, "trùng id bài chuẩn → khung 1");
      assert.ok(/Barbell_Deadlift\/0\.jpg$/.test(r.one.src), "chỉ có 1 ảnh → dùng ảnh đó");
      assert.ok(/Zercher_Squat\/0\.jpg$/.test(r.zer.src));
      assert.equal(r.none.kind, "neutral"); assert.equal(r.none.equip, "band");
    });

    t.test("LT-05: hàng thư viện / tìm kiếm — ảnh đúng bài; thiếu ảnh → ô trung tính (SVG dụng cụ + chữ tắt), không <img> người", ()=>{
      const leg = app.call("libRowHTMLBase", app.evj(`libBuiltinItems().find(x=> x.id==="legext")`));
      assert.ok(/<img class="thumb" src="https:\/\/tapeasy\.app\/media\/ex3d\/lever-leg-extension\.jpg"/.test(leg) && /loading="lazy"/.test(leg), leg);
      const bul = app.call("libRowHTMLBase", app.evj(`libBuiltinItems().find(x=> x.id==="bulgarian")`));
      assert.ok(/class="thumb fk-thn"/.test(bul) && /data-equip="dumbbell"/.test(bul) && /<b>BSS<\/b>/.test(bul) && !/<img/.test(bul), bul);
      const ev = app.ev(`typeof exdbVi !== "undefined" && exdbVi.rowHTML ? exdbVi.rowHTML(libBuiltinItems().find(x=> x.id==="hacksquat")) : libRowHTMLBase(libBuiltinItems().find(x=> x.id==="hacksquat"))`);
      assert.ok(/sled-hack-squat\.jpg/.test(ev), ev);
      const evil = app.call("fkThumbHTML", { kind:"neutral", equip:"\"><script>", hue:"1;x", abbr:"<i>" }, { cls:"thumb", alt:"\"><b>" });
      assert.ok(!/<script>|<i>|"><b>/.test(evil), evil);
      assert.ok(/libThumbHTML\(x\)/.test(read("library.js")) && /libThumbHTML\(x\)/.test(read("exdb-vi.js")));
    });

    t.test("LT-06: giáo án / màn tập — thẻ bài dùng ảnh đúng bài; bài tự tạo không ảnh → ô trung tính (không còn IMG.muscle_core)", ()=>{
      const r = app.evj(`({
        core: fkPlanThumbSrc({ exerciseId:"hacksquat" }),
        stock: fkPlanThumbSrc({ exerciseId:"bulgarian", stock:{ thumb:"https://tapeasy.app/media/wger/x.jpg" } }),
        neutral: fkPlanThumbSrc({ exerciseId:"bulgarian" }),
        db: fkPlanThumbSrc({ exerciseId:null, custom:{ name:"Zercher", exDbId:"Zercher_Squat" } }),
        pt: fkPlanThumbSrc({ exerciseId:null, custom:{ name:"Bài PT", img:"https://example.com/a.jpg" } }),
        bare: getExerciseMeta({ exerciseId:null, custom:{ name:"Bài lạ", equipment:"Cáp", muscle:"Lưng" } }).img,
        gone: getExerciseMeta({ exerciseId:"khong_co" }).img,
        tile: fkThumbHTML(fkThumbForItem({ exerciseId:null, custom:{ name:"Bài lạ (Odd Row)", equipment:"Cáp", muscle:"Lưng" } }), { alt:"x" }) })`);
      assert.ok(/sled-hack-squat\.jpg$/.test(r.core), r.core);
      assert.ok(/media\/wger\/x\.jpg$/.test(r.stock), "không có ảnh đúng → dùng ảnh bìa clip đã gắn");
      assert.equal(r.neutral, "", "không ảnh, không clip → ô trung tính");
      assert.ok(/Zercher_Squat\/0\.jpg$/.test(r.db));
      assert.equal(r.pt, "https://example.com/a.jpg");
      assert.equal(r.bare, "assets/ex-thumbs/cable.svg");
      assert.ok(/assets\/ex-thumbs\/\w+\.svg$/.test(r.gone));
      assert.ok(/fk-thn/.test(r.tile) && /<b>OR<\/b>/.test(r.tile), r.tile);
      const src = read("app.js");
      assert.ok(!/IMG\.muscle_core/.test(src), "app.js còn dùng ảnh người chung nhóm cơ làm ảnh dự phòng");
      assert.ok((src.match(/fkPlanThumbSrc\(/g) || []).length >= 6, "thẻ giáo án / chi tiết / màn tập chưa dùng ảnh đúng bài");
    });

    t.test("LT-07: file ô trung tính có đủ, nhỏ gọn, không chứa script; khoá icon khớp fkThumb.ICONS", ()=>{
      const keys = app.evj("Object.keys(fkThumb.ICONS)");
      let total = 0;
      keys.forEach(k=>{
        const f = path.join(ROOT, "assets/ex-thumbs", k + ".svg");
        assert.ok(fs.existsSync(f), "thiếu " + f);
        const s = fs.readFileSync(f, "utf8"); total += s.length;
        assert.ok(/^<svg /.test(s) && !/<script|on\w+=|href=/i.test(s), k);
      });
      assert.ok(total < 8000, "SVG quá nặng: " + total);
    });
  }
};

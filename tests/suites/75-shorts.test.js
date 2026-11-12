/* =========================================================================
   Chuỗi video ngắn 9:16 (13/11/2026) — scripts/shorts/* + .github/workflows/media-shorts.yml + docs/SHORTS.md
   Chạy riêng: node tests/run.js --only 75
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { assert } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
const E = require(path.join(ROOT, "scripts/shorts/engine.js"));
const series = ()=> JSON.parse(read("scripts/shorts/series.json"));

module.exports = {
  name: "Video ngắn TapEasy (TikTok/Reels/Shorts)",
  area: "scripts/shorts · media-shorts.yml · docs/SHORTS.md",
  async define(t){
    t.test("series.json: 14 short, id duy nhất, 9:16 1080×1920 @30, mỗi short đủ hook/nhịp/caption/bìa/5–8 hashtag", ()=>{
      const S = series();
      assert.equal(S.shorts.length, 14);
      assert.equal(S.w, 1080); assert.equal(S.h, 1920); assert.equal(S.fps, 30);
      const ids = S.shorts.map(s=> s.id);
      assert.equal(new Set(ids).size, 14, "trùng id");
      S.shorts.forEach(s=>{
        assert.ok(/^[a-z0-9-]+$/.test(s.id), "id " + s.id);
        assert.ok(Array.isArray(s.hook) && s.hook.length >= 1 && s.hook.length <= 2, "hook " + s.id);
        assert.ok(s.beats.length >= 4 && s.beats.length <= 7, "3–6 nhịp + hook " + s.id);
        assert.deepEqual(s.beats[0].h, s.hook, "nhịp đầu = hook " + s.id);
        assert.ok(s.caption && s.cover && s.title, "caption/cover/title " + s.id);
        assert.ok(s.hashtags.length >= 5 && s.hashtags.length <= 8 && s.hashtags.every(h=> /^#[\p{L}\p{N}_]+$/u.test(h)), "hashtag " + s.id);
        assert.ok(s.hashtags.includes("#TapEasy"), "#TapEasy " + s.id);
      });
      assert.equal(S.end_card.title, "Tải miễn phí trong cộng đồng TapEasy");
      assert.ok(fs.existsSync(path.join(ROOT, "scripts/intro-video/assets/zalo-community-qr.jpg")), "QR cộng đồng");
    });

    t.test("Kế hoạch dựng: 15–45 s, hook trọn ≤ 1,5 s, thẻ kết ≥ 2 s, phụ đề ≤ 2 dòng, ≤ 2,5 s có điều mới, cũng đúng khi lời đọc chậm 10 %", ()=>{
      const S = series();
      S.shorts.forEach(s=>{
        const P = E.plan(S, s.id);
        assert.ok(P.duration >= 15 && P.duration <= 45, `${s.id}: ${P.duration}s`);
        assert.ok(P.hook.t_full <= 1.5 && P.beats[0].t0 === 0, s.id + ": hook");
        assert.ok(P.end.t1 - P.end.t0 >= 2, s.id + ": thẻ kết");
        assert.ok(P.chunks.every(c=> c.lines.length <= 2), s.id + ": phụ đề > 2 dòng");
        assert.ok(E.maxGap(P) <= E.MAX_GAP, s.id + ": quãng tĩnh " + E.maxGap(P));
        // lời thật chậm hơn ước tính 10 % → prep.js tăng tempo ≤ 1,15 vẫn về ≤ 45 s
        const slow = {}; s.beats.forEach((b, i)=> slow[i] = E.estDur(b.say) * 1.1); slow.end = E.estDur(S.end_card.say) * 1.1;
        const P2 = E.plan(S, s.id, slow);
        assert.ok(P2.duration <= 45 * 1.15, s.id + ": lời chậm → " + P2.duration);
      });
    });

    t.test("Chủ đề bắt buộc: BMR/TDEE, tăng cơ vs giảm mỡ, giấc ngủ, calo, protein, ≥ 3 demo app, hành trình 12 tuần (minh hoạ), phá bẫy, sắp ra mắt", ()=>{
      const S = series(); const T = S.shorts.map(s=> s.title).join(" | ");
      [/BMR & TDEE/, /tăng cơ vs giảm mỡ/i, /giấc ngủ/i, /sai lầm khi tính calo/i, /Protein bao nhiêu/i, /Tìm PT/, /16 giao diện/, /Thực đơn món Việt/, /kg × lần/, /Tập bụng có giảm mỡ bụng/, /Sắp ra mắt/]
        .forEach(r=> assert.match(T, r));
      assert.ok(S.shorts.filter(s=> s.pillar === "app-demo").length >= 3);
      const j = S.shorts.filter(s=> s.pillar === "hanh-trinh");
      assert.ok(j.length >= 1 && j.every(s=> s.illustrative && /minh hoạ/i.test(s.title + s.sources + s.caption)), "hành trình phải ghi rõ ví dụ minh hoạ");
      // không ảnh người thật trước–sau: hành trình chỉ dùng biểu đồ/màn app/ảnh AI
      j.forEach(s=> s.beats.forEach(b=> [].concat(b.v).forEach(v=> assert.ok(["chart","heat","beforeafter","phone","stat","list","img"].includes(v.k), v.k))));
      // nội dung sức khoẻ có nguồn + lời dè dặt
      S.shorts.filter(s=> s.pillar === "kien-thuc" || s.pillar === "myth").forEach(s=> assert.ok(/^Nguồn: /.test(s.sources) && s.disclaimer, "nguồn/tuyên bố " + s.id));
      assert.match(S.shorts.find(s=> s.id === "giac-ngu").beats.map(b=> b.say).join(" "), /bảy đến chín tiếng/);
    });

    t.test("Số liệu BMR/TDEE trong kịch bản = Mifflin–St Jeor (app.js calcBMR) × PAL (data.js), giảm mỡ −18 % / tăng cơ +12 %", ()=>{
      const S = series(); const s = S.shorts.find(x=> x.id === "bmr-tdee"); const ex = s.example;
      const bmr = 10 * ex.weight + 6.25 * ex.height - 5 * ex.age + 5;
      assert.equal(bmr, 1645); assert.equal(E.mifflin(ex), 1645); assert.equal(ex.bmr, 1645);
      assert.match(read("app.js"), /const base = 10\*p\.weight \+ 6\.25\*p\.height - 5\*p\.age;/);
      assert.match(read("data.js"), /id: "moderate"[^\n]*factor: 1\.55/);
      assert.match(read("data.js"), /kcalAdjust: -0\.18/); assert.match(read("data.js"), /kcalAdjust: 0\.12/);
      const tdee = Math.round(bmr * 1.55);
      assert.equal(tdee, 2550); assert.equal(ex.tdee, tdee);
      assert.equal(Math.round(tdee * 0.82), ex.lose); assert.equal(Math.round(tdee * 1.12), ex.gain);
      const txt = JSON.stringify(s.beats);
      assert.ok(txt.includes("1.645") && txt.includes("2.550") && txt.includes("2091") && txt.includes("2856") && txt.includes("×1,55"), "số hiển thị khớp");
      const calc = s.beats.find(b=> [].concat(b.v).some(v=> v.k === "calc")); const c = [].concat(calc.v).find(v=> v.k === "calc");
      assert.deepEqual(c.rows.map(r=> r[1]), ["700", "1.075", "−135", "+5"]); assert.equal(c.total.v, 1645);
    });

    t.test("Bảo mật: không có khoá API trong mã/kịch bản/workflow; workflow lấy khoá từ secrets, không in khoá; TTS dùng lại tts.py (che khoá)", ()=>{
      const files = fs.readdirSync(path.join(ROOT, "scripts/shorts")).filter(f=> /\.(js|py|json|html|css)$/.test(f)).map(f=> "scripts/shorts/" + f)
        .concat([".github/workflows/media-shorts.yml", "docs/SHORTS.md"]);
      files.forEach(f=> assert.ok(!/sk-[A-Za-z0-9_-]{16,}/.test(read(f)), "khoá API trong " + f));
      const yml = read(".github/workflows/media-shorts.yml");
      assert.match(yml, /TTS_API_KEY: \$\{\{ secrets\.IMG_API_KEY \}\}/);
      assert.ok(!/echo[^\n]*(TTS_API_KEY|IMG_API_KEY)/.test(yml), "không echo khoá");
      const py = read("scripts/shorts/tts.py");
      assert.match(py, /intro-video", "tts\.py"/); assert.ok(!/print\([^\n]*KEY\b/.test(py));
    });

    t.test("Workflow: workflow_dispatch (ids, app_url, voice, commit), ma trận song song, tapeasy-bot, chỉ commit media/shorts, pull --rebase", ()=>{
      const yml = read(".github/workflows/media-shorts.yml");
      assert.match(yml, /workflow_dispatch:/);
      ["ids:", "app_url:", "voice:", "commit:"].forEach(k=> assert.ok(yml.includes(k), k));
      assert.match(yml, /default: "https:\/\/thangvu030198-ai\.github\.io\/fitkit-app\/"/);
      assert.match(yml, /fromJSON\(needs\.prepare\.outputs\.groups\)/);
      assert.match(yml, /git config user\.name "tapeasy-bot"/);
      assert.match(yml, /git add media\/shorts\n/); assert.ok(!/git add (?!media\/shorts)/.test(yml), "chỉ add media/shorts");
      assert.match(yml, /git pull --rebase && git push/);
      assert.match(yml, /timeout-minutes: 40/);
      assert.ok(fs.existsSync(path.join(ROOT, "media/shorts/.gitkeep")));
      // không sửa bộ intro: workflow intro không nhắc shorts
      assert.ok(!/shorts/.test(read(".github/workflows/media-intro-video.yml")));
    });

    t.test("Bộ dựng: không URL/GitHub trên khung hình, chỉ CTA QR cộng đồng; vùng chữ trong vùng an toàn TikTok (220 trên / 420 dưới / 140 phải)", ()=>{
      const js = read("scripts/shorts/shorts.js"), ser = read("scripts/shorts/series.json");
      assert.ok(!/github/i.test(js + ser + read("scripts/shorts/shorts.html") + read("scripts/shorts/engine.js")), "có chữ github");
      assert.ok(!/https?:\/\//.test(js + ser), "có URL");
      assert.match(js, /qr\.jpg/);
      assert.deepEqual(E.SAFE, { top:220, bottom:420, right:140, left:60 });
      ["kicker", "head", "card", "cap", "src"].forEach(k=>{ const z = E.ZONES[k];
        assert.ok(z.x >= 60 && z.x + z.w <= 940 && z.y >= 220 && z.y + z.h <= 1500, k); });
      // render(t) thuần: không Date.now / Math.random trong bộ dựng
      assert.ok(!/Date\.now\(\)|Math\.random\(\)/.test(js + read("scripts/shorts/engine.js")));
    });

    t.test("Phụ đề karaoke: chia theo âm tiết trong đoạn lời, không chồng thời gian, SRT hợp lệ", ()=>{
      const S = series(); const P = E.plan(S, "giac-ngu", { 0:3, 1:2.5, 2:4, 3:5, 4:3.2, 5:2.8, end:1.8 });
      const vis = P.chunks.filter(c=> !c.hidden);
      for(let i = 1; i < vis.length; i++) assert.ok(vis[i].t0 >= vis[i - 1].t1 - 1e-6, "chồng " + i);
      vis.forEach(c=> c.lines.flat().forEach(w=> assert.ok(w.t1 >= w.t0 && w.t0 >= c.t0 - 0.1 && w.t1 <= P.end.t1)));
      assert.equal(P.beats[1].voice.dur, 2.5); assert.equal(P.voice, true);
      const srt = E.srt(P);
      assert.match(srt, /^1\n00:00:00,\d{3} --> 00:00:0\d,\d{3}\n/);
      assert.ok(E.syl("1.645") > E.syl("calo") && E.syl("BMR") === 3);
    });

    t.test("Smoke offline (DOM giả, không trình duyệt): render(t) mọi khung 14 short + kiểm bố cục", ()=>{
      const out = execFileSync(process.execPath, [path.join(ROOT, "scripts/shorts/smoke_node.js"), "--quick"], { encoding:"utf8", timeout:120000 });
      assert.match(out, /TẤT CẢ ĐẠT/);
    });

    t.test("docs/SHORTS.md: cách chạy, đủ 14 short (hook, caption, hashtag), lịch đăng 2 tuần", ()=>{
      const md = read("docs/SHORTS.md"); const S = series();
      S.shorts.forEach(s=> assert.ok(md.includes(s.id) && md.includes(s.hashtags[1]), "thiếu " + s.id));
      assert.match(md, /media-shorts\.yml/); assert.match(md, /Lịch đăng/); assert.match(md, /Tuần 2/);
      assert.ok(!/github\.com/i.test(md) || /không hiện/i.test(md));
    });
  },
};

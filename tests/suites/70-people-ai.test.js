/* =========================================================================
   Ảnh có người → ảnh minh hoạ tạo bằng AI (12/11/2026)
   scripts/ai_people_prompts.json · scripts/gen_ai_images.py · media-people-ai.yml · people-ai.js
   docs/AI-PEOPLE-IMAGES.md. Chạy riêng: node tests/run.js --only 70-people
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
const BASE = "https://thangvu030198-ai.github.io/fitkit-app/media/people-ai/";
/* Ảnh Pexels đã kiểm kê là KHÔNG có người (món ăn / phong cảnh / đồ vật) — giữ nguyên, không cần ảnh AI */
const NOT_PEOPLE = ["30635703", "30635714", "16211481", "1640771", "3850841", "760719"];
const BRANDS = /\b(nike|adidas|puma|reebok|under ?armou?r|lululemon|gymshark|asics|new balance|fila|decathlon|domyos|rogue|eleiko|technogym|life ?fitness|concept ?2|peloton|hyrox|crossfit|garmin|apple watch|strava|zumba|coca|pepsi|red ?bull|gatorade|tapeasy)\b/i;
const CELEBS = /\b(celebrity-like|looks like|lookalike|in the style of [A-Z]|ronaldo|messi|schwarzenegger|the rock|dwayne|chris hemsworth|son heung|ngoc trinh|son tung|my tam|quang hai|lee min|bts|blackpink)\b/i;

/* mọi Pexels photo id ảnh tĩnh trong mã nguồn (không tính video PXV) */
function inventory(){
  const ids = new Map();
  const put = (id, where)=>{ if(!ids.has(id)) ids.set(id, where); };
  const data = read("data.js");
  for(const m of data.matchAll(/^\s*(\w+): "https:\/\/images\.pexels\.com\/photos\/(\d+)\//gm)) put(m[2], "data.js IMG." + m[1]);
  for(const m of read("cloud-events.js").matchAll(/\bPX\((\d+),/g)) put(m[1], "cloud-events.js");
  const pt = read("cloud-pt-directory.js");
  for(const m of pt.matchAll(/cover:\[(\d+),/g)) put(m[1], "cloud-pt-directory.js cover");
  for(const al of pt.matchAll(/album:\[(.*?)\] \}/g)) for(const m of al[1].matchAll(/\[(\d+),/g)) put(m[1], "cloud-pt-directory.js album");
  const rvp = /const RVP = \{([^}]*)\}/.exec(pt); assert.ok(rvp, "không thấy RVP");
  for(const m of rvp[1].matchAll(/(\d+):/g)) put(m[1], "cloud-pt-directory.js RVP");
  /* URL ảnh ngoài khác (Unsplash/Pixabay ảnh/Wikimedia ảnh/avatar mẫu) trong mã app: phải không còn */
  return ids;
}

module.exports = {
  name: "Ảnh có người → ảnh minh hoạ AI",
  area: "scripts/ai_people_prompts.json · gen_ai_images.py · media-people-ai.yml · people-ai.js · findpt/events credit",
  async define(t){
    const P = JSON.parse(read("scripts/ai_people_prompts.json"));

    t.test("Manifest: id hợp lệ & duy nhất, khung đúng, cutout:false, có must_have/must_not (tay/ngón, logo, người nổi tiếng)", ()=>{
      assert.ok(Array.isArray(P) && P.length >= 100, "manifest quá ít mục: " + P.length);
      const ids = P.map(x=> x.id);
      assert.equal(new Set(ids).size, ids.length, "trùng id");
      P.forEach(x=>{
        assert.ok(/^[a-z0-9][a-z0-9-]{1,63}$/.test(x.id), "id lạ " + x.id);
        assert.ok(["1024x1536", "1536x1024", "1024x1024"].includes(x.size), "size lạ " + x.id);
        assert.equal(x.cutout, false, "cutout phải false " + x.id);
        assert.ok(x.name && Array.isArray(x.used_in) && x.used_in.length, "thiếu name/used_in " + x.id);
        assert.ok(typeof x.prompt === "string" && x.prompt.length > 200, "prompt ngắn " + x.id);
        assert.ok((x.extra || /Vietnamese/.test(x.prompt)) && /no logos/i.test(x.prompt) && /No text, no watermark/.test(x.prompt), "thiếu chuỗi phong cách " + x.id);
        assert.ok(Array.isArray(x.must_have) && x.must_have.length >= 3, "must_have " + x.id);
        const mn = (x.must_not || []).join(" | ");
        assert.ok(/finger/i.test(mn) && /logo/i.test(mn) && /celebrit/i.test(mn) && /tattoo/i.test(mn), "must_not thiếu tay/logo/người nổi tiếng/xăm chữ " + x.id);
        assert.ok(Array.isArray(x.replaces_pexels) && x.replaces_pexels.every(p=> /^\d+$/.test(p)), "replaces_pexels " + x.id);
      });
      const by = s=> P.filter(x=> x.size === s).length;
      assert.ok(by("1024x1536") >= 20, "ảnh hero/bìa PT nên khung dọc");
      P.filter(x=> /^pt-[a-z]+$/.test(x.id)).forEach(x=> assert.equal(x.size, "1024x1536", "bìa PT phải dọc " + x.id));
      P.filter(x=> /^hero-/.test(x.id)).forEach(x=> assert.equal(x.size, "1024x1536", "hero phải dọc " + x.id));
    });

    t.test("Prompt: không thương hiệu / người nổi tiếng; đa dạng (nữ, trung niên/cao tuổi, thừa cân)", ()=>{
      P.forEach(x=>{
        const all = [x.prompt].concat(x.must_have).join(" ");
        assert.ok(!BRANDS.test(all), "tên thương hiệu trong prompt " + x.id + ": " + (all.match(BRANDS) || [])[0]);
        assert.ok(!CELEBS.test(all), "gợi người nổi tiếng " + x.id);
      });
      const txt = P.map(x=> x.prompt).join("\n");
      assert.ok(/\bwoman\b/.test(txt) && /\bman\b/.test(txt), "thiếu đa dạng giới tính");
      assert.ok(/plus-size|overweight/.test(txt), "thiếu người thừa cân");
      assert.ok(/in (his|her) (40s|50s|60s)|7\d-year-old|older (man|woman)/.test(txt), "thiếu người trung niên/cao tuổi");
    });

    t.test("Seed PT: mỗi PT 1 ảnh bìa riêng, đúng giới tính với seed", ()=>{
      const pt = read("cloud-pt-directory.js");
      const seeds = [...pt.matchAll(/\{ id:"seed_(\w+)", name:"[^"]+".*?gender:"(male|female)"/gs)].map(m=> ({ k: m[1], g: m[2] }));
      assert.equal(seeds.length, 20);
      seeds.forEach(s=>{
        const c = P.find(x=> x.id === "pt-" + s.k); assert.ok(c, "thiếu bìa PT " + s.k);
        const re = s.g === "male" ? /\bVietnamese man\b/ : /\bVietnamese woman\b/;
        assert.ok(re.test(c.prompt), "giới tính PT lệch " + s.k);
      });
    });

    t.test("Kiểm kê: mọi ảnh Pexels có người đều có ánh xạ trong people-ai.js; ánh xạ khớp manifest; không ánh xạ ảnh món ăn", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      const MAP = app.evj("fkPeopleAI.MAP");
      const inv = inventory();
      const miss = [...inv.keys()].filter(id=> !NOT_PEOPLE.includes(id) && !MAP[id]);
      assert.deepEqual(miss, [], "ảnh có người chưa có ánh xạ: " + miss.map(id=> id + " (" + inv.get(id) + ")").join(", "));
      NOT_PEOPLE.forEach(id=> assert.ok(!MAP[id], "không được ánh xạ ảnh không có người " + id));
      Object.keys(MAP).forEach(id=> assert.ok(inv.has(id), "ánh xạ thừa (không còn trong mã) " + id));
      const ids = new Set(P.map(x=> x.id));
      Object.values(MAP).forEach(v=> assert.ok(ids.has(v), "ánh xạ tới id không có trong manifest " + v));
      P.forEach(x=> x.replaces_pexels.forEach(p=> assert.equal(MAP[p], x.id, "replaces_pexels lệch " + x.id)));
      const doc = read("docs/AI-PEOPLE-IMAGES.md");
      P.forEach(x=> assert.ok(doc.includes("`" + x.id + "`"), "docs thiếu " + x.id));
      /* không còn URL ảnh người từ nguồn ngoài khác trong mã app */
      ["app.js", "pt.js", "ptprofile.js", "community.js", "templates.js", "shop-data.js", "landing.html", "kb.js"].forEach(f=>{
        const s = read(f);
        assert.ok(!/https:\/\/(images\.unsplash\.com|cdn\.pixabay\.com\/photo|upload\.wikimedia\.org\/[^"'\s]*\.(jpe?g|png)|randomuser\.me|i\.pravatar\.cc|picsum\.photos)/i.test(s), "URL ảnh ngoài trong " + f);
      });
    });

    t.test("fkPeopleImg: chưa có index → trả URL cũ, IMG giữ nguyên; có index → URL Pages (to/nhỏ), id lạ bị loại", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      const old = app.ev("IMG.heroWorkout1");
      assert.ok(/images\.pexels\.com\/photos\/38453108\//.test(old), "IMG gốc phải còn Pexels khi chưa có ảnh AI");
      assert.equal(app.ev(`fkPeopleImg(${JSON.stringify(old)})`), old);
      assert.equal(app.ev("fkPeopleAI.active()"), false);
      const r = app.evj(`(()=>{
        const n = fkPeopleAI.setIndex({ "hero-workout-1":{ file:"hero-workout-1.webp" }, "pt-khang":{ file:"pt-khang.webp" }, "evil":{ file:"evil.webp" }, "muscle-core":{ file:"x.webp" } });
        const u = "https://images.pexels.com/photos/6550865/pexels-photo-6550865.jpeg?auto=compress&cs=tinysrgb&w=360";
        return { n, img: IMG.heroWorkout1, big: fkPeopleImg(u, false), small: fkPeopleImg(u), core: fkPeopleImg(IMG.muscle_core),
          other: fkPeopleImg("https://images.pexels.com/photos/30635703/a.jpeg"), video: fkPeopleImg("https://images.pexels.com/videos/38667750/pexels-photo-38667750.jpeg"),
          isAi: fkPeopleAI.isAi(u), cycle: typeof HERO_CYCLE !== "undefined" ? HERO_CYCLE[0] : "",
          ex: Object.values(EXERCISES).some(e=> /media\\/people-ai\\//.test(e.img || "")) };
      })()`);
      assert.equal(r.n, 2, "chỉ nhận id có trong MAP + đúng tên file");
      assert.equal(r.img, BASE + "hero-workout-1.webp");
      assert.equal(r.big, BASE + "pt-khang.webp");
      assert.equal(r.small, BASE + "pt-khang-sm.webp", "w=360 → bản nhỏ");
      assert.ok(/pexels/.test(r.core), "id chưa có file → giữ URL cũ");
      assert.ok(/pexels/.test(r.other) && /pexels/.test(r.video), "ảnh món ăn / poster video không bị đổi");
      assert.ok(r.isAi && r.cycle === BASE + "hero-workout-1.webp", "HERO_CYCLE phải đổi theo");
      assert.equal(r.ex, false, "EXERCISES dùng IMG.muscle_* chưa có ảnh AI → giữ nguyên");
    });

    t.test("index.json: tải 1 lần (fixture), cache localStorage → lần mở sau đổi IMG ngay lúc nạp; mất mạng → giữ URL cũ", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true }, fixtures:{ "media/people-ai/index.json": "people-ai-index.json" } });
      const n = await app.ev("fkPeopleAI.load()");
      assert.equal(n, 3);
      await app.ev("fkPeopleAI.load()");
      assert.equal(app.fetchLog.filter(u=> /media\/people-ai\/index\.json/.test(u)).length, 1, "index.json phải tải đúng 1 lần");
      assert.equal(app.ev("IMG.heroWorkout1"), BASE + "hero-workout-1.webp");
      const cached = app.localStorage.getItem("fk_people_ai_idx");
      assert.ok(cached && JSON.parse(cached).ids.length === 3, "chưa cache index");
      const app2 = await t.app({ state:{ onboarded:true, authDone:true }, storage:{ fk_people_ai_idx: cached }, fixtures:{ "media/people-ai/index.json": "__offline__" } });
      assert.equal(app2.ev("IMG.heroWorkout1"), BASE + "hero-workout-1.webp", "cache phải áp dụng đồng bộ trước app.js");
      assert.equal(app2.ev("HERO_CYCLE[0]"), BASE + "hero-workout-1.webp");
      assert.equal(app2.loadErrors.length, 0, app2.loadErrors.map(e=> e.file + ": " + e.error).join("; "));
      const app3 = await t.app({ state:{ onboarded:true, authDone:true }, fixtures:{ "media/people-ai/index.json": "__offline__" } });
      assert.equal(await app3.ev("fkPeopleAI.load()"), 0);
      assert.ok(/images\.pexels\.com/.test(app3.ev("IMG.heroWorkout2")), "mất mạng, chưa cache → URL cũ");
    });

    t.test("Credit: ảnh mẫu đã thay ghi 'Ảnh minh hoạ tạo bằng AI'; ảnh chưa thay vẫn ghi Pexels", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      const h = app.evj(`(()=>{
        const m = TapMedia.pexels(37191727, "Cara Denison", "x"), k = TapMedia.pexels(16966303, "Ardit Mbrati", "y");
        const before = TapMedia.creditHTML ? TapMedia.creditHTML(m) : (window.TapMediaUI && TapMediaUI.creditHTML(m));
        fkPeopleAI.setIndex({ "ev-run-dawn":{ file:"ev-run-dawn.webp" } });
        const ui = (typeof TapMediaUI !== "undefined" && TapMediaUI) || TapMedia;
        return { before, after: ui.creditHTML(m), other: ui.creditHTML(k) };
      })()`);
      assert.ok(/Cara Denison/.test(h.before || h.other), "trước khi có ảnh AI vẫn ghi tác giả Pexels");
      assert.ok(/Ảnh minh hoạ tạo bằng AI/.test(h.after), h.after);
      assert.ok(/Ardit Mbrati/.test(h.other) && /Pexels/.test(h.other), h.other);
      const fp = read("findpt.js"), ev = read("events.js");
      assert.ok((fp.match(/fpAi\(\)/g) || []).length >= 5 && /fkPeopleAI\.LABEL/.test(fp), "findpt.js chưa đổi credit");
      assert.ok(/Ảnh minh hoạ tạo bằng AI/.test(ev), "events.js chưa đổi ghi chú ảnh mẫu");
    });

    t.test("Script & workflow: khoá chỉ từ env/secret, không có khoá trong mã; manifest/outdir qua env; 2 cỡ WebP q82", ()=>{
      const py = read("scripts/gen_ai_images.py"), yml = read(".github/workflows/media-people-ai.yml"), js = read("people-ai.js");
      assert.ok(/os\.environ\.get\("IMG_API_KEY"/.test(py) && /sys\.exit\(/.test(py) && /def redact/.test(py), "phải đọc khoá từ env, dừng khi thiếu, che khoá");
      assert.ok(/IMG_MANIFEST/.test(py) && /IMG_OUTDIR/.test(py) && /size_of\(it\)/.test(py) && /WEBP_Q = 82|WEBP_Q\s*=\s*\d+, 82|82/.test(py) && /-sm\.webp/.test(py), "script chưa tổng quát");
      assert.ok(/BIG, SMALL, WEBP_Q = 1280, 480, 82/.test(py), "cỡ 1280/480, q82");
      [py, yml, js, JSON.stringify(P)].forEach(s=> assert.ok(!/sk-[A-Za-z0-9_-]{16,}|Bearer [A-Za-z0-9]{16,}/.test(s), "có khoá API trong mã!"));
      assert.ok(/IMG_API_KEY:\s*\$\{\{\s*secrets\.IMG_API_KEY\s*\}\}/.test(yml), "workflow phải lấy khoá từ secrets");
      assert.ok(/IMG_MANIFEST:\s*scripts\/ai_people_prompts\.json/.test(yml) && /IMG_OUTDIR:\s*media\/people-ai/.test(yml), "workflow thiếu env manifest/outdir");
      assert.ok(/git add media\/people-ai/.test(yml) && /gpt-image-2\.5/.test(yml) && /apivn\.vn\/v1/.test(yml), "workflow thiếu commit / model / base_url");
      ["model", "base_url", "ids", "limit", "quality", "force"].forEach(k=> assert.ok(new RegExp("\\n\\s+" + k + ":\\s*\\{").test(yml), "thiếu input " + k));
    });

    t.test("Đóng gói: people-ai.js ngay sau data.js trong index.html; có trong sw.js ASSETS và prepare-www.sh", ()=>{
      const html = read("index.html");
      const order = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m=> m[1]);
      const i = order.indexOf("data.js");
      assert.ok(i >= 0 && order[i + 1] === "people-ai.js", "people-ai.js phải đứng ngay sau data.js");
      assert.ok(read("sw.js").includes('"./people-ai.js"'), "sw.js thiếu");
      assert.ok(/data\.js people-ai\.js/.test(read("scripts/prepare-www.sh")), "prepare-www.sh thiếu");
    });
  }
};

/* TapEasy — Kho kiến thức (kb.js + kb-data-1..6.js)
   Chạy riêng: node tests/run.js --only kb
   Nạp app thật (index.html) + 7 file của module ngay TRƯỚC health-safety.js (đúng INTEGRATION-kb.md). */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert, expectNone } = require("../lib/framework");
const { scriptOrder, APP_DIR } = require("../lib/harness");

const MODS = ["kb-data-1.js", "kb-data-2.js", "kb-data-3.js", "kb-data-4.js", "kb-data-5.js", "kb-data-6.js", "kb.js"];
function order(){
  const base = scriptOrder().filter(f=> !MODS.includes(f));
  let i = base.indexOf("health-safety.js"); if(i < 0) i = base.length;
  return base.slice(0, i).concat(MODS, base.slice(i));
}
const NEED = { "bat-dau":10, "ky-thuat":10, "tang-co":8, "giam-mo":8, "dinh-duong":10, "phuc-hoi":8, "phu-nu":6, "cardio":6, "tam-ly":4,
  "pt-nghe":3, "pt-sang-loc":3, "pt-giao-an":4, "pt-kinh-doanh":5, "pt-dao-duc":2 };
const PT_CATS = Object.keys(NEED).filter(c=> c.startsWith("pt-"));

module.exports = {
  name: "Kho kiến thức TapEasy (kb.js)",
  area: "Nội dung (kb.js · kb-data-*.js)",
  async define(t){
    const app = await t.app({ scripts: order(), settleMs: 120 });
    const J = expr=> app.evj(expr);
    const html = id=> app.lastHtml(id);
    const run = code=> app.ev(`(async()=>{ ${code} })()`);
    // Giả lập quyền: có rbac.js (index.html vòng 3) → thay TE_RBAC.can (teCan của RBAC không cho gán đè); không có → gán teCan
    const setPerms = (p)=> app.run(`globalThis.__kbPerms = ${JSON.stringify(p || {})};
      if(window.TE_RBAC && typeof TE_RBAC.can === "function"){ TE_RBAC.__kbOrigCan = TE_RBAC.__kbOrigCan || TE_RBAC.can; TE_RBAC.can = function(x){ return !!(globalThis.__kbPerms || {})[x]; }; }
      else teCan = function(x){ return !!(globalThis.__kbPerms || {})[x]; };`);

    t.test("Nạp không lỗi, TEKB cài đặt, bọc đủ 7 hàm của app, TE_KB cho bảng quản trị", ()=>{
      assert.deepEqual(app.loadErrors.map(e=> e.file + ": " + e.error.message), []);
      assert.equal(app.ev("TEKB.installed"), true);
      assert.equal(app.ev("TE_KB === TEKB"), true);
      const w = J("TEKB.wrapped");
      ["goto","openSheet","renderHomeScreen","renderCoachScreen","openExerciseDetail","openLibDetail","fkHandleBack"].forEach(n=> assert.ok(w.includes(n), "chưa bọc " + n));
      assert.equal(app.consoleLog.filter(l=> (l[0] === "warn" || l[0] === "error") && /\[kb\]/.test(l[1])).length, 0, "có cảnh báo [kb]");
      assert.equal(J("SUB_SCREENS.includes('kb')"), true);
    });

    t.test("≥ 80 bài, đủ số bài từng chuyên mục, id duy nhất, ≥ 120 thuật ngữ, ≥ 40 hỏi đáp", ()=>{
      const n = app.ev("TEKB.articles.length"); assert.ok(n >= 80, "số bài: " + n);
      assert.equal(app.ev("window.KB_ARTICLES.length"), n, "bài gốc bị loại khi chuẩn hoá");
      const cnt = J("TEKB.articles.reduce((m,a)=>{ m[a.cat]=(m[a.cat]||0)+1; return m; }, {})");
      expectNone(Object.keys(NEED).filter(c=> (cnt[c] || 0) < NEED[c]).map(c=> `${c}: ${cnt[c] || 0}/${NEED[c]}`), "Chuyên mục thiếu bài");
      const ids = J("window.KB_ARTICLES.map(a=>a.id)"); assert.equal(new Set(ids).size, ids.length, "trùng id");
      const g = J("TEKB.glossary.map(x=>x.t)"); assert.ok(g.length >= 120, "thuật ngữ: " + g.length); assert.equal(new Set(g).size, g.length, "trùng thuật ngữ");
      assert.ok(app.ev("TEKB.faq.length") >= 40, "FAQ: " + app.ev("TEKB.faq.length"));
      assert.ok(app.ev("TEKB.faq.filter(f=>f.aud==='pt').length") >= 8, "FAQ cho PT < 8");
      const nt = app.ev("TEKB.articles.filter(a=>!a.cat.startsWith('pt-')).length"), np = app.ev("TEKB.articles.filter(a=>a.cat.startsWith('pt-')).length");
      assert.ok(nt >= 70 && np >= 17, `người tập ${nt}, PT ${np}`);
      t.info("Số bài theo chuyên mục", Object.entries(cnt).map(([k, v])=> `${k}: ${v}`));
    });

    t.test("Mỗi bài đủ trường + nội dung có cấu trúc (mục, danh sách/bảng, hộp Áp dụng ngay, Lưu ý an toàn, nguồn)", ()=>{
      const rows = J(`TEKB.articles.map(a=>({ id:a.id, cat:a.cat, aud:a.audience, t:a.title, s:a.summary, tags:a.tags.length, min:a.minutes, up:a.updated, src:a.sources.length,
        words:a.words, h2:a.blocks.filter(b=>b.type==='h2').length, list:a.blocks.some(b=>b.type==='ul'||b.type==='ol'||b.type==='table'),
        boxes:a.blocks.filter(b=>b.type==='box').map(b=>b.kind), tables:a.blocks.filter(b=>b.type==='table').length }))`);
      const bad = [];
      rows.forEach(r=>{
        const pt = r.cat.startsWith("pt-");
        if(!/^[a-z0-9-]{3,}$/.test(r.id)) bad.push(r.id + ": id");
        if(!["nguoi-tap","pt","ca-hai"].includes(r.aud)) bad.push(r.id + ": đối tượng");
        if(pt && r.aud !== "pt") bad.push(r.id + ": bài PT phải có audience 'pt'");
        if(r.t.length < 15 || r.s.length < 40) bad.push(r.id + ": tiêu đề/tóm tắt quá ngắn");
        if(r.tags < 2) bad.push(r.id + ": < 2 thẻ");
        if(!(r.min >= 1)) bad.push(r.id + ": phút đọc");
        if(!/^2026-\d\d-\d\d$/.test(r.up)) bad.push(r.id + ": ngày cập nhật");
        if(r.src < 1) bad.push(r.id + ": thiếu nguồn");
        if(r.words < 200) bad.push(r.id + ": < 200 từ (" + r.words + ")");
        if(r.h2 < 1 && !r.list) bad.push(r.id + ": không có cấu trúc");
        if(!r.list) bad.push(r.id + ": thiếu danh sách/bảng");
        if(!r.boxes.includes("ap-dung")) bad.push(r.id + ": thiếu hộp Áp dụng ngay");
        if(!pt && !r.boxes.includes("an-toan")) bad.push(r.id + ": thiếu hộp Lưu ý an toàn");
        if(pt && !r.boxes.some(k=> k === "an-toan" || k === "luu-y")) bad.push(r.id + ": thiếu hộp Lưu ý");
      });
      expectNone(bad, "Bài thiếu thành phần");
      const tables = rows.reduce((s, r)=> s + r.tables, 0);
      assert.ok(tables >= 70, "tổng số bảng: " + tables);
      t.info("Thống kê nội dung", [`${rows.length} bài · ${rows.reduce((s, r)=> s + r.words, 0)} từ · ${tables} bảng · ${rows.reduce((s, r)=> s + r.src, 0)} nguồn`]);
    });

    t.test("Liên kết bài tập (EXERCISES), giáo án mẫu (PROGRAM_TEMPLATES), bài ↔ bài, thuật ngữ/FAQ → bài đều tồn tại", ()=>{
      const bad = J(`(()=>{ const out = []; const tpl = new Set(PROGRAM_TEMPLATES.map(t=>t.id));
        window.KB_ARTICLES.forEach(a=>{
          (a.ex||[]).forEach(x=>{ if(!EXERCISES[x]) out.push(a.id + " ex:" + x); });
          (a.tpl||[]).forEach(x=>{ if(!tpl.has(x)) out.push(a.id + " tpl:" + x); });
          String(a.body).replace(/\\[\\[(ex|kb|tpl):([a-z0-9_-]+)/gi, (m,k,x)=>{ k=k.toLowerCase();
            if(k==='ex' && !EXERCISES[x]) out.push(a.id + " [[ex:" + x + "]]");
            if(k==='tpl' && !tpl.has(x)) out.push(a.id + " [[tpl:" + x + "]]");
            if(k==='kb' && !TEKB.byId(x)) out.push(a.id + " [[kb:" + x + "]]"); return m; });
        });
        TEKB.glossary.forEach(g=>{ if(g.kb && !TEKB.byId(g.kb)) out.push("thuật ngữ " + g.t + " → " + g.kb); });
        TEKB.faq.forEach(f=>{ if(f.kb && !TEKB.byId(f.kb)) out.push("FAQ " + f.q + " → " + f.kb); });
        return out; })()`);
      expectNone(bad, "Liên kết hỏng");
      const used = J("[...new Set(TEKB.articles.flatMap(a=>a.links.ex))].length");
      assert.ok(used >= 40, "số bài tập khác nhau được liên kết: " + used);
      const linked = J("TEKB.articles.filter(a=>a.links.ex.length || a.links.tpl.length).length");
      assert.ok(linked >= 70, "bài có liên kết bài tập/giáo án: " + linked);
      const trainCats = ["bat-dau","ky-thuat","tang-co","giam-mo","cardio","phu-nu"];
      expectNone(J(`TEKB.articles.filter(a=>${JSON.stringify(trainCats)}.includes(a.cat) && !a.links.ex.length && !a.links.tpl.length).map(a=>a.id)`), "Bài tập luyện chưa liên kết bài tập/giáo án");
      const dead = (html => (html.match(/kb-dead/g) || []).length)(J("TEKB.articles.map(a=>TEKB.mdToHTML(a.body)).join('')"));
      assert.equal(dead, 0, "liên kết chết trong HTML");
    });

    t.test("Nguồn: mọi URL là https, không trùng bài, chứa tổ chức/tạp chí uy tín", ()=>{
      const srcs = J("TEKB.articles.flatMap(a=>a.sources.map(s=>({id:a.id, t:s.t, u:s.u||''})))");
      expectNone(srcs.filter(s=> s.u && !/^https:\/\//.test(s.u)).map(s=> s.id + " " + s.u), "URL không phải https");
      const trusted = /(ACSM|American College of Sports Medicine|NSCA|National Strength|ISSN|International Society of Sports Nutrition|WHO|World Health|Viện Dinh dưỡng|Bộ Y tế|Cochrane|Br J Sports Med|J Strength Cond Res|Sports Med|Med Sci Sports Exerc|J Int Soc Sports Nutr|Lancet|JAMA|N Engl J Med|NICE|NHS|IOC|Quốc hội|Chính phủ|Bộ VHTTDL|Am J|Eur J|J Physiol|Front|PLoS|Obstet|Physiotherapy|Ann Intern Med|Sleep|HYROX|EFSA|Harvard|Institute for Credentialing|American Council on Exercise|Tổng cục|Int J|Curr|Appl Physiol|J Orthop|Acta Orthop|Strength Cond J|Adv|Health|Obes|Body Image|Psychol|J Hum Kinet|PeerJ|Prev Med|J Bone|Hypertension|J Am|J Clin|Precision Nutrition|Goom|Cơ sở dữ liệu|USDA|U\.S\. Department|National Academy|J Sport|J Athl|Scand J|SAGE|Sports \(Basel\)|Best Pract|Cardiopulm|Guilford|PAR-Q|Clin Nutr|Uniformed Services|Code of Ethics|ACE)/i;
      expectNone(srcs.filter(s=> !trusted.test(s.t)).map(s=> s.id + ": " + s.t.slice(0, 80)), "Nguồn chưa rõ uy tín");
      const per = J("TEKB.articles.map(a=>[a.id, a.sources.length, new Set(a.sources.map(s=>s.t)).size])");
      expectNone(per.filter(([, n, u])=> n !== u).map(([id])=> id), "Nguồn trùng trong cùng bài");
    });

    t.test("Tìm kiếm không dấu bằng chỉ mục đảo ngược: có dấu = không dấu, tiền tố, đồng nghĩa, cụm từ, khớp một phần", ()=>{
      assert.equal(app.ev("TEKB.fold('Đạm Đường ĐẬU phụ')"), "dam duong dau phu");
      assert.ok(app.ev("TEKB.index.map.size") > 1000, "chỉ mục quá nhỏ: " + app.ev("TEKB.index.map.size"));
      assert.ok(app.ev("TEKB.index.map.get('squat').has('a:kt-squat')"), "posting 'squat' thiếu kt-squat");
      const ids = q=> J(`TEKB.search(${JSON.stringify(q)}, {tab:'all'}).articles.map(x=>x.id)`);
      assert.deepEqual(ids("giảm mỡ"), ids("giam mo"), "có dấu ≠ không dấu");
      assert.deepEqual(ids("ĐAU GỐI"), ids("dau goi"), "chữ hoa ≠ chữ thường");
      const top = (q, id, n)=> { const L = ids(q).slice(0, n || 3); assert.ok(L.includes(id), `"${q}" → top ${n || 3} không có ${id}: ${L.join(", ")}`); };
      top("dau goi", "ph-dau-goi", 1); top("hop dong", "pt-hop-dong"); top("chinh sach huy", "pt-chinh-sach-huy", 1); top("mang thai", "pn-mang-thai", 1);
      top("hyrox", "cd-hyrox-la-gi"); top("protein", "dd-protein"); top("dam", "dd-protein"); top("deadlift", "kt-deadlift", 1);
      top("ngu", "ph-giac-ngu"); top("pho com tam", "dd-mon-viet-ngoai-hang", 1); top("chung chi", "pt-chung-chi", 1); top("valsalva", "kt-tho-siet-bung", 1);
      top("creat", "dd-thuc-pham-bo-sung", 1);                          // tiền tố khi đang gõ
      assert.ok(J("TEKB.search('creat').glossary.map(x=>x.item.t)").some(x=> /Creatine/.test(x)), "tiền tố không ra thuật ngữ");
      assert.ok(J("TEKB.search('rir').glossary.map(x=>x.item.t)")[0].startsWith("RIR"), "thuật ngữ RIR không đứng đầu");
      assert.ok(J("TEKB.search('huy buoi').faq.map(x=>x.item.q)").some(x=> /huỷ buổi/.test(x)), "FAQ không tìm được");
      const p = J("TEKB.search('squat zzqqxx', {tab:'all'})"); assert.equal(p.partial, true); assert.ok(p.articles.length > 0, "khớp một phần rỗng");
      assert.equal(J("TEKB.search('va la cua').total"), 0, "chỉ có từ dừng phải rỗng");
      assert.equal(J("TEKB.search('   ').total"), 0);
      const ptTab = J("TEKB.search('khach hang', {tab:'nguoi-tap'}).articles.map(x=>x.item.audience)");
      assert.ok(ptTab.every(a=> a !== "pt"), "tab Người tập lọt bài PT");
      const t0 = Date.now(); app.ev("for(let i=0;i<300;i++) TEKB.search('dinh duong cho nguoi tap ta')"); const ms = Date.now() - t0;
      assert.ok(ms < 1500, "300 lượt tìm mất " + ms + " ms");
      t.info("Tìm kiếm", [`chỉ mục: ${app.ev("TEKB.index.map.size")} từ khoá · 300 lượt tìm ${ms} ms`, `"giam mo" → ${ids("giam mo").slice(0, 4).join(", ")}`]);
    });

    t.test("Đoạn trích tô sáng đúng vị trí trên chữ có dấu và được escape", ()=>{
      const s = app.ev(`TEKB.snippet("Ăn đủ đạm <b>mỗi</b> ngày giúp giữ cơ", ["dam"])`);
      assert.ok(s.includes("<mark>đạm</mark>"), s);
      assert.ok(s.includes("&lt;b&gt;") && !s.includes("<b>"), "đoạn trích không escape: " + s);
    });

    t.test("Escape: markdown, tìm kiếm, bài do biên tập viên nhập không chèn được HTML/JS", ()=>{
      const evil = `<img src=x onerror=alert(1)> **<script>alert(2)</script>** [[ex:"><svg onload=alert(3)>]] [[kb:x"onclick="alert(4)|<i>a</i>]]\n:::an-toan <b>Tiêu đề</b>\n<iframe src=javascript:alert(5)>\n:::\n| <a href=javascript:alert(6)>x</a> | y |\n|---|---|\n| 1 | 2 |`;
      const out = app.ev(`TEKB.mdToHTML(${JSON.stringify(evil)})`);
      ["<img", "<script", "<svg", "<iframe", "<a href=javascript", 'onclick="alert'].forEach(bad=> assert.ok(!out.includes(bad), "lọt " + bad + ": " + out));
      assert.ok(out.includes("&lt;img") && out.includes("kb-box--an-toan"), "markdown hợp lệ vẫn phải chạy");
      const r = app.ev(`TEKB._html.results(${JSON.stringify("<img src=x onerror=alert(1)>")})`);
      assert.ok(!r.includes("<img") && r.includes("&lt;img"), "kết quả tìm kiếm không escape");
      app.ev(`TEKB.open({ q: ${JSON.stringify("\"><script>alert(1)</script>")} })`);
      assert.ok(!html("kb-content").includes("<script>alert"), "ô tìm kiếm không escape");
      setPerms({ "kb.edit":true, "kb.publish":true });
      const res = J(`TEKB.saveArticle({ title:'<img src=x onerror=alert(1)> Bài thử XSS', summary:'Tóm tắt <script>alert(1)</script> đủ dài để hợp lệ nhé', audience:'ca-hai', cat:'tam-ly',
        tags:['<b>x</b>','thử'], sources:['Nguồn thử | javascript:alert(1)', 'Nguồn 2 | https://example.org/a"onmouseover=1'], body:'## Mục\\n\\nNội dung đủ dài cho bài thử nghiệm escape, có **đậm** và [[ex:squat]] cùng [[kb:kt-squat]]. Thêm vài chữ cho đủ tám mươi ký tự.\\n\\n:::ap-dung\\n- Làm ngay\\n:::' }, 'publish')`);
      assert.equal(res.ok, true, JSON.stringify(res));
      const a = app.ev(`TEKB._html.article(${JSON.stringify(res.id)})`);
      const card = app.ev(`TEKB._html.home()`) + app.ev(`TEKB._html.results("bai thu xss")`);
      [a, card].forEach(h=>{ const m = /<img|<script|href="javascript|[\s"]onmouseover=/.exec(h); assert.ok(!m, "lọt mã: " + (m ? h.slice(Math.max(0, m.index - 80), m.index + 80) : "")); });
      assert.ok(!a.includes('href="https://example.org'), "URL nguồn có dấu nháy phải bị loại");
      assert.ok(a.includes("&lt;img src=x onerror=alert(1)&gt; Bài thử XSS"), "tiêu đề không hiển thị dạng chữ");
      assert.ok(/^u-[a-z0-9-]+$/.test(res.id), "id bài mới không an toàn: " + res.id);
      app.ev(`TEKB.revert(${JSON.stringify(res.id)})`);
      setPerms({});
    });

    t.test("Màn Kho kiến thức: tab Người tập / PT / Tất cả, lưới chuyên mục gradient, lối tắt, thẻ chủ đề", ()=>{
      app.ev("TEKB.setTab('nguoi-tap'); TEKB.open()");
      assert.ok(app.dom.registry.get("screen-kb").classList.contains("active"), "screen-kb chưa active");
      let h = html("kb-content");
      assert.equal((h.match(/data-kb-tab=/g) || []).length, 3, "phải có 3 tab");
      assert.ok(/aria-selected="true"[^>]*data-kb-tab="nguoi-tap"/.test(h), "tab Người tập chưa chọn");
      const catsNT = (h.match(/class="kb-cat fk-dark-island" data-kb-cat="/g) || []).length;
      assert.ok(catsNT >= 9, "lưới chuyên mục người tập: " + catsNT);
      assert.ok(/--g1:#[0-9A-Fa-f]{6};--g2:#[0-9A-Fa-f]{6}/.test(h), "thiếu gradient");
      assert.ok(h.includes('data-kb-view="glossary"') && h.includes('data-kb-view="faq"') && h.includes('data-kb-view="saved"'), "thiếu lối tắt");
      assert.ok(h.includes("data-kb-tag="), "thiếu thẻ chủ đề");
      assert.ok(h.includes("Dành cho bạn"), "thiếu gợi ý");
      assert.ok(!h.includes('data-kb-cat="pt-'), "tab Người tập hiện chuyên mục PT");
      app.ev("TEKB.setTab('pt')"); h = html("kb-content");
      const first = /data-kb-cat="([a-z-]+)"/.exec(h)[1];
      assert.ok(first.startsWith("pt-"), "tab PT phải đưa chuyên mục PT lên đầu: " + first);
      PT_CATS.forEach(c=> assert.ok(h.includes(`data-kb-cat="${c}"`), "thiếu " + c));
      app.ev("TEKB.setTab('all')"); h = html("kb-content");
      Object.keys(NEED).forEach(c=> assert.ok(h.includes(`data-kb-cat="${c}"`), "Tất cả thiếu " + c));
      app.ev("TEKB.openCat('phu-nu')"); h = html("kb-content");
      assert.equal((h.match(/class="kb-card[ "]/g) || []).length, 6, "chuyên mục Phụ nữ phải có 6 bài");
      assert.equal(app.dom.registry.get("kb-title").textContent, "Phụ nữ tập luyện");
      app.ev("TEKB.nav({view:'tag', tag:'Hyrox'})"); h = html("kb-content");
      assert.ok(h.includes('data-kb-open="cd-hyrox-la-gi"') && h.includes('data-kb-open="cd-luyen-hyrox"'), "lọc thẻ Hyrox");
      app.ev("TEKB.nav({view:'glossary'})"); h = html("kb-content");
      assert.ok(/data-kb-letter="A"/.test(h) && /data-kb-letter="Z"/.test(h) && (h.match(/class="kb-term"/g) || []).length >= 120, "Thuật ngữ A–Z");
      app.ev("TEKB.nav({view:'faq'})"); h = html("kb-content");
      assert.ok((h.match(/<details class="kb-faq">/g) || []).length >= 20, "Hỏi đáp");
      app.ev("TEKB.back(); TEKB.back(); TEKB.back();");
      assert.equal(app.ev("TEKB.ui.view"), "cat", "nút quay lại trong kho");
    });

    t.test("Trang đọc: mục lục, thân bài có cấu trúc, liên kết bài tập & giáo án, nguồn, bài liên quan, lưu – đã đọc – chia sẻ – cỡ chữ", async ()=>{
      setPerms({});
      app.ev("TEKB.openArticle('bd-4-tuan-dau')");
      const h = html("kb-content");
      ["kb-toc", "kb-body", "kb-box--ap-dung", "kb-box--an-toan", "<table>", "Nguồn tham khảo", "Bài liên quan", 'data-kb-act="save"', 'data-kb-act="read"', 'data-kb-act="share"', 'data-kb-act="font"', "Giáo án mẫu liên quan", "kb-nextprev"]
        .forEach(s=> assert.ok(h.includes(s), "trang đọc thiếu " + s));
      assert.ok(h.includes('data-tpl="tpl-m-fb"') && h.includes('data-ex="bwsquat"') && h.includes('data-kb-open="bd-who-van-dong"'), "thiếu liên kết giáo án/bài tập/bài viết");
      assert.ok(/scholar\.google\.com\/scholar\?q=/.test(h), "nguồn không có liên kết tra cứu");
      assert.ok(/rel="noopener noreferrer"/.test(h));
      assert.ok(!h.includes('data-kb-act="edit"'), "người thường không được thấy nút Sửa");
      assert.equal(app.dom.registry.get("screen-kb").classList.contains("kb-reading"), true, "thiếu chế độ đọc (thanh tiến độ)");
      assert.equal(app.ev("TEKB.toggleSave('bd-4-tuan-dau')"), true);
      assert.equal(app.ev("TEKB.setRead('bd-4-tuan-dau', true)"), true);
      const saved = JSON.parse(app.localStorage.getItem("fitkit_state_v1")).kb;
      assert.ok(saved.saved.includes("bd-4-tuan-dau") && saved.read["bd-4-tuan-dau"] > 0 && saved.recent[0] === "bd-4-tuan-dau", "chưa lưu state.kb");
      assert.ok(/data-kb-open="bd-4-tuan-dau"[\s\S]{0,1200}?kb-flag--read/.test(app.ev("TEKB._html.cat('bat-dau')")), "thẻ bài chưa hiện Đã đọc");
      const fs0 = app.ev("TEKB.state.fs"); app.ev("TEKB.cycleFont()"); assert.equal(app.ev("TEKB.state.fs"), (fs0 + 1) % 3);
      assert.equal(await run("return await TEKB.share('bd-4-tuan-dau')"), "copied");
      assert.match(app.ev("TEKB.shareUrl('bd-4-tuan-dau')"), /\?kb=bd-4-tuan-dau$/);
      assert.ok(J("TEKB.related(TEKB.byId('bd-4-tuan-dau'), 4).map(a=>a.id)").includes("bd-who-van-dong"), "bài liên quan chưa hợp lý");
      assert.ok(J("TEKB.related(TEKB.byId('bd-chon-lich-tap'), 4).map(a=>a.id)").includes("tc-tan-suat"), "bài liên quan (lịch tập ↔ tần suất)");
      app.ev("TEKB.toggleSave('bd-4-tuan-dau')");
    });

    t.test("Gợi ý theo mục tiêu, giới tính, vai trò PT; Kiến thức hôm nay cố định trong ngày, đổi theo ngày", async ()=>{
      const catsFor = (goal, gender)=> J(`(()=>{ state.profile.goal=${JSON.stringify(goal)}; state.profile.gender=${JSON.stringify(gender || "male")}; return TEKB.recommend(4, {pt:false, seed:'x'}).map(a=>a.cat); })()`);
      const lose = catsFor("lose"); assert.ok(lose.filter(c=> ["giam-mo","dinh-duong","cardio","bat-dau","ky-thuat"].includes(c)).length >= 3, "lose: " + lose);
      assert.ok(lose.includes("giam-mo"), "lose thiếu giam-mo: " + lose);
      const gain = catsFor("gain"); assert.ok(gain.includes("tang-co"), "gain: " + gain);
      const fem = J("(()=>{ state.profile.goal='maintain'; state.profile.gender='female'; return TEKB.recommend(8, {pt:false, seed:'x'}).map(a=>a.cat); })()");
      assert.ok(fem.includes("phu-nu"), "nữ: " + fem);
      assert.ok(J("TEKB.recommend(20, {pt:false}).every(a=>a.audience!=='pt')"), "người tập được gợi ý bài PT");
      await run(`await cloud.signOut(); await cloud.signUp("kb.pt@tapeasy.vn", "matkhau1", "PT Kho"); await cloud.updateMyProfile({ isPT:true });`);
      const pt = J("TEKB.recommend(4).map(a=>a.cat)"); assert.ok(pt.filter(c=> c.startsWith("pt-")).length >= 3, "PT: " + pt);
      app.ev("TEKB.ui.tab = null; TEKB.state.tab = null; TEKB.open()");
      assert.ok(/aria-selected="true"[^>]*data-kb-tab="pt"/.test(html("kb-content")), "PT mở kho phải vào tab PT");
      await run(`await cloud.signOut();`);
      app.setNow("2026-11-11T09:00"); const d1 = app.ev("TEKB.todayPick().id"); assert.equal(app.ev("TEKB.todayPick().id"), d1, "đổi trong ngày");
      const picks = new Set(); for(let i = 0; i < 7; i++){ app.setNow(`2026-11-${String(12 + i).padStart(2, "0")}T09:00`); picks.add(app.ev("TEKB.todayPick().id")); }
      assert.ok(picks.size >= 3, "7 ngày chỉ ra " + picks.size + " bài khác nhau");
      app.setNow(null);
      app.ev("state.profile.goal='gain'; state.profile.gender='male'");
    });

    t.test("Điểm vào: menu ☰ (chèn trước Giấc ngủ), ô 'Kiến thức hôm nay' trong teHomeExplore, thẻ trong khu TapEasy PT", ()=>{
      const appJs = fs.readFileSync(path.join(APP_DIR, "app.js"), "utf8");
      assert.ok(appJs.includes(`<div class="link-row" onclick="goto('sleep');closeSheet();">`) || appJs.includes(`<div class="link-row" onclick="goto('reminders');closeSheet();">`), "menu app.js đã đổi cấu trúc — cập nhật injectMenuString()");
      const menu = `<div class="link-row" onclick="goto('coach');closeSheet();">PT</div><div class="link-row" onclick="goto('sleep');closeSheet();">Ngủ</div><div class="link-row" onclick="goto('reminders');closeSheet();">Nhắc</div>`;
      app.call("openSheet", menu);
      const sc = html("sheet-content");
      assert.ok(sc.includes("data-kb-menu") && sc.includes("Kho kiến thức"), "menu chưa có Kho kiến thức");
      assert.ok(sc.indexOf("data-kb-menu") < sc.indexOf("goto('sleep')") && sc.indexOf("goto('coach')") < sc.indexOf("data-kb-menu"), "vị trí mục menu");
      app.call("openSheet", "<p>sheet khác</p>"); assert.ok(!html("sheet-content").includes("data-kb-menu"), "chèn nhầm vào sheet khác");
      app.call("closeSheet");
      if(app.ev("typeof teHomeExplore") !== "undefined"){
        assert.equal(app.ev("teHomeExplore.has('kb')"), true, "chưa đăng ký teHomeExplore");
        const it = J("(()=>{ const x = teHomeExplore.list().find(i=>i.id==='kb'); return x && { t:x.title, sub: typeof x.sub==='function'? x.sub() : x.sub, icon:x.icon }; })()");
        // vòng tích hợp 3: ô tên "Kho kiến thức" (nhóm Tìm PT · Cộng đồng · Sự kiện · Kiến thức · Gian hàng), phụ đề = bài hôm nay
        assert.equal(it.t, "Kho kiến thức"); assert.ok(it.sub && /^Hôm nay: /.test(it.sub) && it.sub.length > 12, "sub: " + it.sub);
        app.call("renderHomeScreen");
        assert.ok(html("home-content").includes('data-xid="kb"'), "ô Khám phá không hiện trên Trang chủ");
        assert.ok(!html("home-content").includes('id="kb-home"'), "không được chèn thẻ dự phòng khi đã có teHomeExplore");
        app.ev("teHomeExplore.open('kb')");
        assert.equal(app.ev("TEKB.ui.view"), "home", "bấm ô phải mở trang đầu Kho kiến thức");
        const kbHtml = html("kb-content") || html("screen-kb") || app.ev("(document.getElementById('screen-kb')||{}).innerHTML||''");
        assert.ok(kbHtml.includes("Kiến thức hôm nay") && kbHtml.includes(app.ev("TEKB.todayPick().id")), "trang đầu kho phải có bài Kiến thức hôm nay");
      }
      const card = app.ev("TEKB.homeCardHTML()");
      assert.ok(card.includes("Kiến thức hôm nay") && /TEKB\.openArticle\('[a-z0-9-]+'\)/.test(card), "thẻ dự phòng");
      app.ev("goto('coach')");
      app.call("renderCoachScreen", false);
      assert.ok(html("coach-content").includes('id="kb-coach"') && html("coach-content").includes("Kho kiến thức cho PT"), "thiếu thẻ trong khu PT");
      app.call("renderCoachScreen", false);
      assert.equal((html("coach-content").match(/id="kb-coach"/g) || []).length, 1, "thẻ PT bị chèn trùng");
    });

    t.test("Chi tiết bài tập có nút 'Tìm hiểu thêm' khi có bài liên quan (giáo án + thư viện bài tập)", ()=>{
      app.run(`(function(){ const plan = getActivePlan(); const d = plan.days[state.selectedDay];
        d.items.push({ uid:'kbtest1', exerciseId:'squat', sets:3, reps:'8-10', restSec:120, clipId:null });
        d.items.push({ uid:'kbtest2', exerciseId:null, custom:{ name:'Bài tự tạo', muscle:'Chân', equipment:'', guide:'', img:'' }, sets:3, reps:'10', restSec:60, clipId:null }); })()`);
      app.call("openExerciseDetail", "kbtest1", true);
      let sc = html("sheet-content");
      assert.ok(sc.includes("data-kb-exmore") && sc.includes("Tìm hiểu thêm") && sc.includes("TEKB.openArticle('kt-squat')"), "thiếu Tìm hiểu thêm cho squat");
      app.call("closeSheet"); app.call("openExerciseDetail", "kbtest2", true);
      assert.ok(!html("sheet-content").includes("data-kb-exmore"), "bài không có bài liên quan không được hiện nút");
      app.call("closeSheet"); app.call("openLibDetail", "fk:deadlift");
      sc = html("sheet-content");
      assert.ok(sc.includes("TEKB.openArticle('kt-deadlift')"), "thư viện bài tập thiếu Tìm hiểu thêm");
      app.call("closeSheet");
      assert.deepEqual(J("TEKB.forExercise('squat',3).map(a=>a.id)")[0], "kt-squat");
      app.run(`(function(){ const d = getActivePlan().days[state.selectedDay]; d.items = d.items.filter(i=>!/^kbtest/.test(i.uid)); })()`);
    });

    t.test("Điều hướng: goto('kb') ẩn thanh dưới, nút Back Android lùi trong kho rồi về màn trước, liên kết ?kb=", ()=>{
      app.ev("['hs-overlay','sheet-backdrop'].forEach(id=>{ const e = document.getElementById(id); if(e) e.classList.remove('open'); })");   // lớp sàng lọc của health-safety (mở sau khi đăng ký ở test trước) cũng bắt nút Back
      app.ev("goto('home'); TEKB.open(); TEKB.openCat('cardio'); TEKB.openArticle('cd-hyrox-la-gi')");
      assert.equal(app.ev("TEKB.ui.view"), "article");
      assert.equal(app.ev("fkHandleBack()"), true); assert.equal(app.ev("TEKB.ui.view"), "cat");
      assert.equal(app.ev("fkHandleBack()"), true); assert.equal(app.ev("TEKB.ui.view"), "home");
      app.ev("TEKB.openArticle('cd-luyen-hyrox')");
      app.ev("TEKB.openArticle('cd-hyrox-la-gi', {replace:true})");
      app.ev("fkHandleBack()"); assert.equal(app.ev("TEKB.ui.view"), "home", "bài trước/tiếp không được chồng lịch sử");
      assert.ok(/\?kb=pt-dinh-gia$/.test(app.ev("TEKB.shareUrl('pt-dinh-gia')")));
      assert.equal(app.ev("TEKB.byId('../../x')"), null);
    });

    t.test("Phân quyền: không có quyền → không thấy nút biên tập; kb.edit → nháp / gửi duyệt (ẩn với người đọc); kb.publish → xuất bản, gỡ, khôi phục", ()=>{
      setPerms({});
      assert.ok(!app.ev("TEKB._html.home()").includes('data-kb-act="new"'), "người thường thấy Bài mới");
      assert.equal(J("TEKB.saveArticle({title:'Bài không quyền', body:'x'}, 'draft')").ok, false);
      assert.equal(app.ev("TEKB.openEditor()"), false);
      assert.equal(app.ev("TEKB.setPublished('kt-squat', false)"), false);
      setPerms({ "kb.edit":true });
      const home = app.ev("TEKB._html.home()"); assert.ok(home.includes('data-kb-act="new"') && home.includes('data-kb-view="drafts"'), "biên tập viên thiếu nút");
      assert.ok(app.ev("TEKB._html.article('kt-squat')").includes('data-kb-act="edit"'), "thiếu nút Sửa");
      assert.ok(!app.ev("TEKB._html.editor()").includes('data-ed="publish"') && app.ev("TEKB._html.editor()").includes('data-ed="review"'), "kb.edit không được xuất bản");
      const art = { title:"Uống cà phê trước buổi tập sáng", summary:"Liều caffeine hợp lý, thời điểm uống và ai nên tránh trước khi tập.", audience:"nguoi-tap", cat:"dinh-duong",
        tags:["caffeine","cà phê"], ex:["running"], tpl:[], sources:["Guest NS, et al. ISSN position stand: caffeine and exercise performance. J Int Soc Sports Nutr 2021;18:1."],
        body:"## Liều dùng\n\nCaffeine 3–6 mg/kg khoảng 60 phút trước tập, không quá 400 mg/ngày với người lớn khoẻ mạnh.\n\n:::ap-dung\n- Thử 1 ly cà phê sữa 60 phút trước buổi chạy [[ex:running]].\n:::" };
      const bad = J(`TEKB.saveArticle(${JSON.stringify(Object.assign({}, art, { ex:["khong-co"], sources:[] }))}, 'review')`);
      assert.equal(bad.ok, false); assert.ok(bad.errors.some(e=> /khong-co/.test(e)) && bad.errors.some(e=> /nguồn/.test(e)), JSON.stringify(bad.errors));
      assert.equal(J(`TEKB.saveArticle(${JSON.stringify(art)}, 'publish')`).ok, false, "kb.edit xuất bản được");
      const r = J(`TEKB.saveArticle(${JSON.stringify(art)}, 'review')`);
      assert.equal(r.ok, true); assert.equal(r.status, "review");
      assert.equal(app.ev(`TEKB.byId(${JSON.stringify(r.id)})`), null, "bài chờ duyệt lộ ra cho người đọc");
      assert.ok(app.ev("TEKB._html.drafts()").includes("Uống cà phê trước buổi tập sáng") && app.ev("TEKB._html.drafts()").includes("Chờ duyệt"));
      assert.ok(J("TEKB.adminList()").some(x=> x.id === r.id && x.status === "review"), "adminList thiếu bài chờ duyệt");
      setPerms({ "kb.edit":true, "kb.publish":true });
      assert.equal(app.ev(`TEKB.setPublished(${JSON.stringify(r.id)}, true)`), true);
      assert.ok(app.ev(`TEKB.byId(${JSON.stringify(r.id)}) !== null`), "xuất bản xong chưa hiện");
      assert.equal(J("TEKB.search('uong ca phe truoc buoi tap').articles[0].id"), r.id, "chỉ mục chưa cập nhật bài mới");
      assert.equal(app.ev(`TEKB.setPublished(${JSON.stringify(r.id)}, false)`), true);
      assert.equal(app.ev(`TEKB.byId(${JSON.stringify(r.id)})`), null, "gỡ bài chưa ẩn");
      // sửa bài gốc → xuất bản bản sửa → khôi phục bản gốc
      const orig = app.ev("TEKB.byId('kt-squat').title");
      const e = J(`TEKB.saveArticle(Object.assign({}, window.KB_ARTICLES.find(a=>a.id==='kt-squat'), { title:'Squat đúng kỹ thuật (bản sửa thử)' }), 'publish')`);
      assert.equal(e.ok, true); assert.equal(e.id, "kt-squat");
      assert.equal(app.ev("TEKB.byId('kt-squat').title"), "Squat đúng kỹ thuật (bản sửa thử)"); assert.equal(app.ev("TEKB.byId('kt-squat').origin"), "edited");
      assert.ok(app.ev("TEKB._html.article('kt-squat')").includes('data-kb-act="revert"'));
      app.ev("TEKB.revert('kt-squat')");
      assert.equal(app.ev("TEKB.byId('kt-squat').title"), orig, "khôi phục bản gốc");
      app.ev(`TEKB.revert(${JSON.stringify(r.id)})`);
      assert.equal(app.ev("TEKB.articles.length"), app.ev("window.KB_ARTICLES.length"));
      setPerms({});
    });

    t.test("Dữ liệu sạch: không còn 'FIT KIT', không emoji/cờ, không '${', không hứa hẹn y khoa, tiếng Việt có dấu", ()=>{
      const all = J("JSON.stringify([window.KB_ARTICLES, window.KB_GLOSSARY, window.KB_FAQ])");
      assert.ok(!/FIT ?KIT/i.test(all), "còn tên cũ FIT KIT");
      assert.ok(!/\$\{/.test(all), "còn ${");
      assert.ok(!/[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}]/u.test(all), "có emoji");
      const viols = J(`window.KB_ARTICLES.filter(a=>/chữa khỏi|đảm bảo 100/i.test(a.body)).map(a=>a.id)`);
      expectNone(viols, "Hứa hẹn y khoa");
      const noDiacritics = J(`window.KB_ARTICLES.filter(a=> !/[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i.test(a.title + a.summary)).map(a=>a.id)`);
      expectNone(noDiacritics, "Tiêu đề/tóm tắt thiếu dấu");
    });

    t.test("Tệp tích hợp: kb.css dùng token, tài liệu INTEGRATION-kb.md có đủ thẻ <script>/<link>", ()=>{
      const css = fs.readFileSync(path.join(APP_DIR, "kb.css"), "utf8");
      assert.ok(/var\(--mint/.test(css) && /var\(--text/.test(css) && /fk-ov-rgb/.test(css), "kb.css chưa dùng token");
      assert.ok(!/font:[^;]*inherit/.test(css.replace(/font:inherit;/g, "")), "dùng font: … inherit sai cú pháp");
      assert.ok(/prefers-reduced-motion/.test(css));
      const fsz = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map(m=> Number(m[1])).filter(n=> n < 12);
      assert.deepEqual(fsz, [], "chữ < 12px trong kb.css");
      const doc = fs.readFileSync(path.join(APP_DIR, "docs", "INTEGRATION-kb.md"), "utf8");
      MODS.forEach(f=> assert.ok(doc.includes(`<script src="${f}"></script>`), "doc thiếu " + f));
      assert.ok(doc.includes('<link rel="stylesheet" href="kb.css">'));
    });
  }
};

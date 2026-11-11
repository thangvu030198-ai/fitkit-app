/* =========================================================================
   TapEasy — KHO KIẾN THỨC (kb.js + kb.css + kb-data-1..6.js)
   Nạp: kb-data-1.js … kb-data-6.js → kb.js, SAU pt.js / các module khác, TRƯỚC health-safety.js.

   - Màn #screen-kb: tab Người tập / PT / Tất cả · lưới chuyên mục (gradient + icon) · tìm kiếm toàn văn
     KHÔNG DẤU bằng chỉ mục đảo ngược (tiền tố, đồng nghĩa nhẹ, cụm từ) · lọc thẻ · trang đọc (mục lục,
     thanh tiến độ đọc, cỡ chữ, lưu bài, đã đọc, chia sẻ, bài liên quan) · Thuật ngữ A–Z · Hỏi đáp nhanh.
   - Gợi ý theo state.profile.goal, giới tính, số buổi đã tập và vai trò PT (cloud.profile.isPT).
   - Điểm vào: menu ☰ · ô "Kiến thức hôm nay" (teHomeExplore.add; không có thì chèn thẻ vào Trang chủ)
     · thẻ trong khu TapEasy PT · nút "Tìm hiểu thêm" ở chi tiết bài tập · liên kết ?kb=<id> / #kb/<id>.
   - Biên tập: teCan("kb.edit") (markdown nhẹ, lưu nháp / gửi duyệt) · xuất bản / gỡ: teCan("kb.publish").
     Lưu state.kb.custom (máy này) + Firestore collection "kb" khi cloud.mode === "firebase" (rules: INTEGRATION-admin.md).
   - Dữ liệu người dùng: state.kb = { saved[], read{id:ts}, recent[], custom{}, fs, tab }.
   API: window.TEKB (= window.TE_KB) — open(opts), openArticle(id), openCat(id), search(q, opts), recommend(n),
        todayPick(), render(), list({all}), adminList(), setPublished(id, on), saveArticle(obj, mode), …
   Mọi chuỗi từ dữ liệu / người dùng đều qua esc(); markdown được escape TRƯỚC khi định dạng.
   Vòng sửa 2 (fkLazy, QU-01): dữ liệu kb-data-*.js có thể NẠP LƯỜI — kb.js gọi
     await (window.fkLazy ? fkLazy.load('kb') : Promise.resolve()) trước khi dùng (ensureData / TEKB.ready()).
     Dữ liệu đã có sẵn (thẻ <script> còn trong index.html) → dùng ngay, đồng bộ như cũ. Đang tải → khung chờ; lỗi → "Thử lại".
   ========================================================================= */
(function(G){
"use strict";
if(G.TEKB && G.TEKB.installed) return;

/* ---------------------------------------------------------------------
   0. TIỆN ÍCH
   --------------------------------------------------------------------- */
const D = G.document;
const q = (s, r)=>{ try{ return (r || D).querySelector(s); }catch(e){ return null; } };
const esc = s=> String(s == null ? "" : s).replace(/[&<>"'`]/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;", "`":"&#96;" }[c]));
const ic = n=> `<span class="material-symbols-rounded" aria-hidden="true">${String(n || "").replace(/[^a-z0-9_]/gi, "")}</span>`;
const arr = a=> Array.isArray(a) ? a : [];
const uniq = a=> [...new Set(a)];
const warn = (...a)=>{ try{ console.warn("[kb]", ...a); }catch(e){} };
const can = p=>{ try{ return typeof teCan === "function" && !!teCan(p); }catch(e){ return false; } };
const ST = ()=>{ try{ return typeof state !== "undefined" && state ? state : null; }catch(e){ return null; } };
const EXS = ()=>{ try{ return typeof EXERCISES !== "undefined" && EXERCISES ? EXERCISES : {}; }catch(e){ return {}; } };
const TPLS = ()=>{ try{ return typeof PROGRAM_TEMPLATES !== "undefined" && Array.isArray(PROGRAM_TEMPLATES) ? PROGRAM_TEMPLATES : []; }catch(e){ return []; } };
const todayKey = ()=>{ try{ return typeof todayStr === "function" ? todayStr() : new Date().toISOString().slice(0, 10); }catch(e){ return "1970-01-01"; } };
const say = (m, i)=>{ try{ if(typeof toast === "function") toast(m, i || "check_circle"); }catch(e){} };
const persist = ()=>{ try{ if(typeof saveState === "function") saveState(); }catch(e){ warn(e); } };
const SAFE_ID = /^[a-z0-9][a-z0-9-]{1,79}$/;
const cleanId = s=> String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
const fmtDate = d=>{ const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || "")); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
function isPT(){ try{ return !!(typeof cloud !== "undefined" && cloud && cloud.profile && cloud.profile.isPT); }catch(e){ return false; } }
function hash01(s){ let h = 2166136261; s = String(s); for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; }

/* Bỏ dấu tiếng Việt: giữ NGUYÊN độ dài chuỗi (chuỗi NFC) để tô sáng đúng vị trí */
function fold(s){ return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); }
const STOP = new Set(["va","la","cua","nhung","mot","cac","nhu","thi","duoc","nay","voi","trong","khi","ve","tu","den","lai","cung","se","dang","rat","hoac","thuong","nen","bi","cho","nao","gi","the"]);
function tokens(s, keepStop){ return fold(s).split(/[^a-z0-9]+/).filter(t=> t && (t.length > 1 || /\d/.test(t)) && (keepStop || !STOP.has(t))); }
const SYN = { dam:["protein"], protein:["dam"], calo:["kcal"], kcal:["calo"], ganh:["squat"], beo:["mo"], core:["bung"], cardio:["aerobic"], deload:["giam","tai"] };

/* ---------------------------------------------------------------------
   1. CHUYÊN MỤC, ĐỐI TƯỢNG, HỘP NỘI DUNG, ICON
   --------------------------------------------------------------------- */
const CATS = [
  { id:"bat-dau",      aud:"nguoi-tap", label:"Bắt đầu tập",                 icon:"kb_flag",   g:["#1CCFC1","#02625D"], desc:"Lộ trình người mới, lịch tập, khởi động, sàng lọc sức khoẻ." },
  { id:"ky-thuat",     aud:"nguoi-tap", label:"Kỹ thuật & an toàn",          icon:"kb_shield", g:["#FF9466","#B83D0B"], desc:"Squat, deadlift, bench, vai, lưng, thở và dấu hiệu phải dừng tập." },
  { id:"tang-co",      aud:"nguoi-tap", label:"Tăng cơ & sức mạnh",          icon:"fitness_center", g:["#8B6CF0","#2B1F63"], desc:"Khối lượng, RIR, khoảng lặp, nghỉ giữa hiệp, tăng cân, recomp." },
  { id:"giam-mo",      aud:"nguoi-tap", label:"Giảm mỡ",                     icon:"local_fire_department", g:["#FF6B6B","#9A3412"], desc:"Cân bằng năng lượng, tốc độ giảm, giữ cơ, cardio, chững cân." },
  { id:"dinh-duong",   aud:"nguoi-tap", label:"Dinh dưỡng & món Việt",       icon:"restaurant", g:["#57B347","#0D2A1D"], desc:"Calo, đạm, tinh bột, ăn quanh buổi tập, món Việt, bổ sung." },
  { id:"phuc-hoi",     aud:"nguoi-tap", label:"Phục hồi, giấc ngủ & chấn thương", icon:"bedtime", g:["#4CC9F0","#0E3A6B"], desc:"Giấc ngủ, DOMS, deload, đau lưng, vai, gối, khuỷu tay." },
  { id:"phu-nu",       aud:"nguoi-tap", label:"Phụ nữ tập luyện",            icon:"kb_female", g:["#FF7FA3","#7A1F4A"], desc:"Tập tạ, chu kỳ kinh, mang thai, sau sinh, REDs, mãn kinh." },
  { id:"cardio",       aud:"nguoi-tap", label:"Cardio, chạy & Hyrox",        icon:"directions_run", g:["#FFC46B","#9A5A06"], desc:"Vùng nhịp tim, chạy 5 km, giày chạy, Hyrox, không khí." },
  { id:"tam-ly",       aud:"nguoi-tap", label:"Tâm lý & thói quen",          icon:"kb_brain",  g:["#B49CFF","#44308F"], desc:"Thói quen, động lực, lỡ buổi tập, hình ảnh cơ thể." },
  { id:"pt-nghe",      aud:"pt",        label:"Nghề PT & chứng chỉ",         icon:"kb_badge",  g:["#33D6C9","#08254A"], desc:"Chứng chỉ quốc tế, pháp lý tại Việt Nam, phạm vi hành nghề." },
  { id:"pt-sang-loc",  aud:"pt",        label:"Sàng lọc & đánh giá",         icon:"kb_clip",   g:["#5EE6C7","#114650"], desc:"Sàng lọc ACSM, đánh giá thể lực, buổi tư vấn đầu tiên." },
  { id:"pt-giao-an",   aud:"pt",        label:"Lập trình giáo án",           icon:"kb_list",   g:["#A6E6FA","#155E96"], desc:"FITT-VP, chu kỳ hoá, nhóm đặc biệt, tự điều chỉnh RPE." },
  { id:"pt-kinh-doanh",aud:"pt",        label:"Kinh doanh PT",               icon:"kb_pay",    g:["#FFB547","#6E2F4F"], desc:"Định giá, hợp đồng, chính sách huỷ, giữ chân khách, marketing." },
  { id:"pt-dao-duc",   aud:"pt",        label:"Giao tiếp & đạo đức",         icon:"kb_chat",   g:["#DCD0FF","#2B1F63"], desc:"Phỏng vấn tạo động lực, ranh giới, bảo mật, xung đột lợi ích." },
];
const CAT = Object.fromEntries(CATS.map(c=> [c.id, c]));
const AUDS = { "nguoi-tap":"Người tập", "pt":"PT", "ca-hai":"Người tập & PT" };
const TABS = [["nguoi-tap","Người tập"], ["pt","PT"], ["all","Tất cả"]];
const BOX = { "ap-dung":["Áp dụng ngay","kb_bolt"], "an-toan":["Lưu ý an toàn","kb_warn"], "meo":["Mẹo","kb_bulb"], "luu-y":["Lưu ý","kb_info"], "pt":["Góc PT","kb_badge"] };
const STATUS = { published:"Đã xuất bản", draft:"Bản nháp", review:"Chờ duyệt" };

function addIcons(){
  try{
    if(typeof FK_LINE !== "object" || !FK_LINE) return;
    const add = {
      kb_flag:"M5 21V4|M5 4h11l-2 4 2 4H5",
      kb_shield:"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z|M9 12l2 2 4-4",
      kb_female:"c:12,9,5|M12 14v7|M9 18h6",
      kb_brain:"M9.5 4A2.5 2.5 0 0 0 7 6.5 2.5 2.5 0 0 0 4.5 9a2.5 2.5 0 0 0 0 5A2.5 2.5 0 0 0 7 17.5 2.5 2.5 0 0 0 9.5 20H12V4z|M14.5 4A2.5 2.5 0 0 1 17 6.5 2.5 2.5 0 0 1 19.5 9a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1-2.5 3.5A2.5 2.5 0 0 1 14.5 20H12V4z",
      kb_badge:"c:12,9,5.5|M8.8 13.6L7.5 21l4.5-2.4 4.5 2.4-1.3-7.4",
      kb_clip:"r:5,4,14,17,2|M9 4V3h6v1|M8.5 10h7|M8.5 14h7|M8.5 18h4",
      kb_list:"M9 6h11|M9 12h11|M9 18h11|c:4.5,6,1|c:4.5,12,1|c:4.5,18,1",
      kb_pay:"r:3,6,18,13,2.5|M3 10h18|M15.5 15h2.5",
      kb_chat:"M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z|M8.5 12h.01|M12 12h.01|M15.5 12h.01",
      kb_bookmark:"M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
      kb_bookmark_on:"M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z|M9 9.5l2 2 4-4",
      kb_share:"c:18,5,2.6|c:6,12,2.6|c:18,19,2.6|M8.3 13.3l7.4 4.4|M15.7 6.3L8.3 10.7",
      kb_check:"c:12,12,9.5|M8 12.2l2.8 2.8L16.2 9.5",
      kb_toc:"M4 6h16|M4 12h11|M4 18h14",
      kb_az:"M3 18l4-12 4 12|M4.4 14h5.2|M14 6.5h7l-7 11h7",
      kb_quiz:"c:12,12,9.5|M9.2 9.2a2.9 2.9 0 0 1 5.6 1c0 2-2.8 2.4-2.8 4.3|M12 17.6h.01",
      kb_tag:"M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z|c:7.5,7.5,1.4",
      kb_text:"M3 19l5-14 5 14|M4.8 14h6.4|M14.5 19l3.2-8.5L21 19|M15.6 16.3h4.3",
      kb_spark:"M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z|M19 16l.7 1.6 1.6.7-1.6.7L19 20.6l-.7-1.6-1.6-.7 1.6-.7z",
      kb_warn:"M12 3.5L21.5 20h-19z|M12 10v4.2|M12 17.2h.01",
      kb_bulb:"M9 18h6|M10 21h4|M12 3a6 6 0 0 0-3.8 10.6c.7.6 1 1.4 1 2.4h5.6c0-1 .3-1.8 1-2.4A6 6 0 0 0 12 3z",
      kb_info:"c:12,12,9.5|M12 11v5.5|M12 7.6h.01",
      kb_bolt:"M13 2.5L4.5 14H12l-1 7.5L19.5 10H12z",
      kb_source:"M7 3h7l5 5v13H7z|M14 3v5h5|M10 13h6|M10 17h6",
      kb_pen:"M4 20h4L19 9l-4-4L4 16z|M13.5 6.5l4 4",
      kb_publish:"M12 20V8|M7 13l5-5 5 5|M5 4h14",
      kb_trash:"M4 7h16|M9 7V4h6v3|M6 7l1 13h10l1-13",
      kb_book:"M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z|M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z",
    };
    Object.keys(add).forEach(k=>{ if(!FK_LINE[k]) FK_LINE[k] = add[k]; });
  }catch(e){ warn(e); }
}

/* ---------------------------------------------------------------------
   2. MARKDOWN NHẸ → KHỐI CÓ CẤU TRÚC → HTML (escape trước khi định dạng)
   ---------------------------------------------------------------------
   ## mục · ### mục con · đoạn văn · "- " / "* " danh sách · "1. " đánh số · | bảng | ·
   :::ap-dung | :::an-toan | :::meo | :::luu-y | :::pt [tiêu đề tuỳ chọn] … ::: ·
   **đậm** · *nghiêng* · [[ex:id|chữ]] · [[kb:id|chữ]] · [[tpl:id|chữ]] */
function slug(s){ return fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "muc"; }
function parseMd(md){
  const lines = String(md == null ? "" : md).replace(/\r\n?/g, "\n").split("\n");
  let hn = 0;
  const isStart = l=> /^\s*$/.test(l) || /^#{2,3}\s+/.test(l) || /^\s*\|/.test(l) || /^\s*[-*]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l) || /^:::/.test(l.trim());
  function parse(ls){
    const out = []; let i = 0;
    while(i < ls.length){
      const line = ls[i], t = line.trim();
      if(!t){ i++; continue; }
      let m;
      if((m = /^:::([a-z-]+)\s*(.*)$/i.exec(t))){
        const kind = BOX[m[1].toLowerCase()] ? m[1].toLowerCase() : "luu-y"; const inner = []; i++;
        let depth = 0;
        while(i < ls.length){ const tt = ls[i].trim(); if(/^:::[a-z-]+/i.test(tt)) depth++; else if(tt === ":::"){ if(depth === 0) break; depth--; } inner.push(ls[i]); i++; }
        i++; out.push({ type:"box", kind, title: (m[2] || "").trim() || BOX[kind][0], blocks: parse(inner) }); continue;
      }
      if((m = /^(#{2,3})\s+(.+)$/.exec(t))){
        const lv = m[1].length, text = m[2].trim(); hn++;
        out.push({ type: lv === 2 ? "h2" : "h3", text, id: "kb-s" + hn + "-" + slug(text) }); i++; continue;
      }
      if(t[0] === "|"){
        const rows = [];
        while(i < ls.length && ls[i].trim()[0] === "|"){
          const r = ls[i].trim();
          if(!/^\|?\s*:?-{2,}/.test(r)) rows.push(r.replace(/^\|/, "").replace(/\|$/, "").split("|").map(c=> c.trim()));
          i++;
        }
        if(rows.length){ const w = Math.max(...rows.map(r=> r.length)); const pad = r=> r.concat(Array(Math.max(0, w - r.length)).fill(""));
          out.push({ type:"table", head: pad(rows[0]), rows: rows.slice(1).map(pad) }); }
        continue;
      }
      if(/^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)){
        const ordered = /^\s*\d+[.)]\s+/.test(line), re = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/, items = [];
        while(i < ls.length && re.test(ls[i])){
          let item = ls[i].replace(re, "").trim(); i++;
          while(i < ls.length && /^\s{2,}\S/.test(ls[i]) && !isStart(ls[i].trim())){ item += " " + ls[i].trim(); i++; }
          items.push(item);
        }
        out.push({ type: ordered ? "ol" : "ul", items }); continue;
      }
      const para = [t]; i++;
      while(i < ls.length && !isStart(ls[i])){ para.push(ls[i].trim()); i++; }
      out.push({ type:"p", text: para.join(" ") });
    }
    return out;
  }
  return parse(lines);
}
function shortEx(name){ return String(name || "").replace(/\s*\([^)]*\)\s*$/, "").trim() || String(name || ""); }
function findTpl(id){ return TPLS().find(t=> t && t.id === id) || null; }
function linkHTML(kind, id, label){
  // label đã được escape (inline() escape toàn chuỗi trước); id chỉ gồm [a-z0-9_-]
  if(kind === "ex"){
    const m = EXS()[id]; if(!m) return `<span class="kb-dead">${label || esc(id)}</span>`;
    return `<button type="button" class="kb-ex" data-ex="${id}">${ic("fitness_center")}<span>${label || esc(shortEx(m.name))}</span></button>`;
  }
  if(kind === "tpl"){
    const t = findTpl(id); if(!t) return `<span class="kb-dead">${label || esc(id)}</span>`;
    return `<button type="button" class="kb-tpl" data-tpl="${id}">${ic("school")}<span>${label || esc(t.name)}</span></button>`;
  }
  const a = byId(id); if(!a) return label || esc(id);
  return `<a href="#kb/${id}" class="kb-alink" data-kb-open="${id}">${label || esc(a.title)}</a>`;
}
function inline(s){
  let h = esc(s);
  h = h.replace(/\[\[(ex|kb|tpl):([a-z0-9_-]{1,80})(?:\|([^\]]{0,160}))?\]\]/gi, (m, k, id, label)=> linkHTML(k.toLowerCase(), id.toLowerCase(), label ? label.trim() : ""));
  h = h.replace(/\*\*([^*]{1,400}?)\*\*/g, "<b>$1</b>");
  h = h.replace(/(^|[\s(>])\*([^*\s][^*]{0,300}?)\*(?=[\s).,;:!?<]|$)/g, "$1<i>$2</i>");
  return h;
}
function plainInline(s){
  return String(s || "").replace(/\[\[(ex|kb|tpl):([a-z0-9_-]+)(?:\|([^\]]*))?\]\]/gi, (m, k, id, label)=>{
    if(label) return label;
    k = k.toLowerCase(); id = id.toLowerCase();
    if(k === "ex"){ const e = EXS()[id]; return e ? e.name : id; }
    if(k === "tpl"){ const t = findTpl(id); return t ? t.name : id; }
    const a = RAW_BY_ID[id]; return a ? a.title : id;
  }).replace(/\*\*?/g, "");
}
function blocksPlain(bs){
  return bs.map(b=> b.type === "box" ? b.title + ". " + blocksPlain(b.blocks)
    : b.type === "table" ? [b.head].concat(b.rows).map(r=> r.map(plainInline).join(" · ")).join(". ")
    : (b.type === "ul" || b.type === "ol") ? b.items.map(plainInline).join(". ")
    : plainInline(b.text)).join("\n");
}
function renderBlocks(bs){
  return arr(bs).map(b=>{
    switch(b.type){
      case "h2": return `<h2 id="${esc(b.id)}">${inline(b.text)}</h2>`;
      case "h3": return `<h3 id="${esc(b.id)}">${inline(b.text)}</h3>`;
      case "p": return `<p>${inline(b.text)}</p>`;
      case "ul": return `<ul>${b.items.map(x=> `<li>${inline(x)}</li>`).join("")}</ul>`;
      case "ol": return `<ol>${b.items.map(x=> `<li>${inline(x)}</li>`).join("")}</ol>`;
      case "table": return `<div class="kb-table" role="region" aria-label="Bảng" tabindex="0"><table><thead><tr>${b.head.map(c=> `<th scope="col">${inline(c)}</th>`).join("")}</tr></thead><tbody>${b.rows.map(r=> `<tr>${r.map(c=> `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      case "box": { const k = BOX[b.kind] ? b.kind : "luu-y";
        return `<aside class="kb-box kb-box--${k}" role="note"><div class="kb-box-h">${ic(BOX[k][1])}<b>${esc(b.title)}</b></div>${renderBlocks(b.blocks)}</aside>`; }
      default: return "";
    }
  }).join("");
}
function mdToHTML(md){ return renderBlocks(parseMd(md)); }

/* ---------------------------------------------------------------------
   3. DỮ LIỆU: bài gốc (window.KB_ARTICLES) + bài sửa/mới (state.kb.custom) → danh sách hiệu lực
   --------------------------------------------------------------------- */
let RAW = [], RAW_BY_ID = {}, ARTS = [], BY_ID = {}, GLOSS = [], FAQ = [], IDX = null;
function st(){
  const s = ST(); const fb = { saved:[], read:{}, recent:[], custom:{}, fs:1, tab:null };
  if(!s) return C.mem || (C.mem = fb);
  const k = s.kb && typeof s.kb === "object" && !Array.isArray(s.kb) ? s.kb : (s.kb = {});
  if(!Array.isArray(k.saved)) k.saved = [];
  if(!k.read || typeof k.read !== "object") k.read = {};
  if(!Array.isArray(k.recent)) k.recent = [];
  if(!k.custom || typeof k.custom !== "object") k.custom = {};
  if(![0,1,2].includes(k.fs)) k.fs = 1;
  return k;
}
function normSrc(x){
  if(!x) return null;
  if(typeof x === "string"){ const t = x.trim(); if(!t) return null;
    const m = /^(.*?)\s*\|\s*(https:\/\/[^\s"'<>`]+)\s*$/.exec(t); return m && m[1] ? { t: m[1].slice(0, 400), u: m[2].slice(0, 400) } : { t: t.slice(0, 400) }; }
  if(typeof x === "object" && x.t){ const u = typeof x.u === "string" && /^https:\/\/[^\s"'<>]+$/.test(x.u) ? x.u : ""; return u ? { t:String(x.t).slice(0, 400), u } : { t:String(x.t).slice(0, 400) }; }
  return null;
}
function norm(a, origin){
  if(!a || typeof a !== "object") return null;
  const id = cleanId(a.id); if(!SAFE_ID.test(id) || !a.title) return null;
  const body = String(a.body || "");
  const blocks = parseMd(body);
  const plain = blocksPlain(blocks).normalize("NFC");
  const words = plain.split(/\s+/).filter(Boolean).length;
  const exIn = [], tplIn = [], kbIn = [];
  body.replace(/\[\[(ex|kb|tpl):([a-z0-9_-]+)/gi, (m, k, x)=>{ k = k.toLowerCase(); x = x.toLowerCase(); (k === "ex" ? exIn : k === "tpl" ? tplIn : kbIn).push(x); return m; });
  return {
    id, title: String(a.title).slice(0, 160), summary: String(a.summary || "").slice(0, 400),
    audience: AUDS[a.audience] ? a.audience : "ca-hai",
    cat: CAT[a.cat] ? a.cat : "bat-dau",
    tags: uniq(arr(a.tags).map(t=> String(t).trim()).filter(Boolean)).slice(0, 12),
    ex: uniq(arr(a.ex).map(cleanIdUnderscore).filter(Boolean)),
    tpl: uniq(arr(a.tpl).map(cleanIdUnderscore).filter(Boolean)),
    sources: arr(a.sources).map(normSrc).filter(Boolean),
    updated: /^\d{4}-\d{2}-\d{2}$/.test(String(a.updated || "")) ? a.updated : "",
    body, blocks, plain, words,
    minutes: Number(a.minutes) > 0 ? Math.round(Number(a.minutes)) : Math.max(1, Math.ceil(words / 200)),
    toc: blocks.filter(b=> b.type === "h2").map(b=> ({ id: b.id, text: b.text })),
    links: { ex: uniq(arr(a.ex).map(cleanIdUnderscore).concat(exIn)), tpl: uniq(arr(a.tpl).map(cleanIdUnderscore).concat(tplIn)), kb: uniq(kbIn) },
    status: STATUS[a.status] ? a.status : "published",
    origin: origin || "builtin", by: a.by ? String(a.by).slice(0, 80) : "", updatedAt: Number(a.updatedAt) || 0,
  };
}
function cleanIdUnderscore(s){ return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 80); }

function loadData(){
  const seen = new Set(); RAW = []; RAW_BY_ID = {};
  arr(G.KB_ARTICLES).forEach(a=>{ const id = a && cleanId(a.id); if(!id || seen.has(id)) return; seen.add(id); RAW.push(a); RAW_BY_ID[id] = a; });
  GLOSS = arr(G.KB_GLOSSARY).filter(g=> g && g.t && g.d).map(g=> ({ t:String(g.t), en:String(g.en || ""), d:String(g.d), kb: g.kb ? cleanId(g.kb) : "" }));
  GLOSS.sort((a, b)=> letterOf(a.t).localeCompare(letterOf(b.t)) || a.t.localeCompare(b.t, "vi"));
  FAQ = arr(G.KB_FAQ).filter(f=> f && f.q && f.a).map(f=> ({ q:String(f.q), a:String(f.a), aud: AUDS[f.aud] ? f.aud : "ca-hai", kb: f.kb ? cleanId(f.kb) : "" }));
  rebuild();
}
function rebuild(){
  const custom = st().custom;
  const out = [];
  RAW.forEach(a=>{
    const id = cleanId(a.id), c = custom[id];
    if(c && c.status === "published" && !c.hidden){ const n = norm(c, "edited"); if(n){ out.push(n); return; } }
    if(c && c.hidden) return;
    const n = norm(a, "builtin"); if(n) out.push(n);
  });
  Object.keys(custom).forEach(id=>{ if(RAW_BY_ID[id]) return; const c = custom[id]; if(c && c.status === "published" && !c.hidden){ const n = norm(c, "custom"); if(n) out.push(n); } });
  ARTS = out; BY_ID = Object.fromEntries(out.map(a=> [a.id, a])); IDX = null;
}
/* Nạp lười dữ liệu (hợp đồng fkLazy — docs/qa/HANDOFF-ROUND-BRIEF.md): st = "idle" | "loading" | "ready" | "error".
   ensureData() KHÔNG bao giờ reject: resolve true (có dữ liệu) / false (lỗi → màn hiện "Thử lại"). */
const DATA = { st:"idle", p:null, err:null, waiters:[] };
function hasData(){ return arr(G.KB_ARTICLES).length > 0; }
function lazyApi(){ try{ return G.fkLazy && typeof G.fkLazy.load === "function" ? G.fkLazy : null; }catch(e){ return null; } }
function ensureData(){
  if(DATA.st === "ready") return Promise.resolve(true);
  if(DATA.p) return DATA.p;
  DATA.st = "loading"; DATA.err = null;
  const lz = lazyApi();
  let pr;
  try{ pr = Promise.resolve(lz ? G.fkLazy.load("kb") : null); }catch(e){ pr = Promise.reject(e); }   // = await (window.fkLazy ? fkLazy.load('kb') : Promise.resolve())
  DATA.p = pr.then(()=>{
    if(!hasData()) throw new Error(lz ? "fkLazy.load('kb') xong nhưng chưa có KB_ARTICLES" : "Chưa có dữ liệu kb-data-*.js");
    loadData(); DATA.st = "ready"; DATA.p = null;
    onDataReady();
    return true;
  }).catch(e=>{
    DATA.st = "error"; DATA.err = e; DATA.p = null; warn("nạp dữ liệu", e && e.message || e);
    try{ if(isActive()) render(); }catch(_){}
    DATA.waiters.splice(0).forEach(w=>{ try{ w(false); }catch(_){} });
    return false;
  });
  return DATA.p;
}
function onDataReady(){
  try{ if(isActive()) render(); }catch(e){ warn(e); }
  try{ if(typeof teHomeExplore !== "undefined" && teHomeExplore && typeof teHomeExplore.refresh === "function") teHomeExplore.refresh(); }catch(e){}
  try{ if(!exploreAvailable()){ const h = q("#screen-home"); if(h && h.classList && h.classList.contains("active")) homeInject(); } }catch(e){}
  try{ const cc = D.getElementById("kb-coach"); if(cc && "outerHTML" in cc) cc.outerHTML = coachCardHTML(); }catch(e){}
  DATA.waiters.splice(0).forEach(w=>{ try{ w(true); }catch(e){ warn(e); } });
}
/** chạy fn khi dữ liệu sẵn sàng (ngay nếu đã có) — dùng cho deep link / mở bài từ nơi khác */
function whenReady(fn){ if(DATA.st === "ready"){ fn(true); return; } DATA.waiters.push(fn); ensureData(); }
function dataStateHTML(){
  if(DATA.st === "error"){
    const off = typeof navigator !== "undefined" && navigator.onLine === false;
    return `<div class="fk-state err kb-state" role="alert">
      <div class="fk-state-ic" aria-hidden="true">${ic(off ? "wifi_off" : "error_outline")}</div>
      <div class="fk-state-tx"><b>Không tải được Kho kiến thức</b><p>${off ? "Đang ngoại tuyến — bật Wi-Fi hoặc dữ liệu di động rồi thử lại." : "Có lỗi khi tải bài viết. Thử lại sau giây lát nhé."}</p></div>
      <button type="button" class="btn btn-outline btn-sm" data-kb-act="retry">${ic("refresh")}Thử lại</button></div>`;
  }
  return `<div class="kb-loading" role="status" aria-live="polite" aria-busy="true"><p class="small-note">Đang tải Kho kiến thức…</p>${typeof fkSkeleton === "function" ? fkSkeleton(4, "card") : ""}</div>`;
}
function byId(id){ return BY_ID[cleanId(id)] || null; }
function letterOf(t){ const c = fold(String(t).trim()).charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; }
function audOk(a, tab){ tab = tab || "all"; if(tab === "all") return true; if(tab === "pt") return a.audience !== "nguoi-tap"; return a.audience !== "pt"; }
function catsFor(tab){
  const L = CATS.filter(c=> ARTS.some(a=> a.cat === c.id && audOk(a, tab)));
  return tab === "pt" ? L.filter(c=> c.aud === "pt").concat(L.filter(c=> c.aud !== "pt")) : L;
}
function countIn(cat, tab){ return ARTS.filter(a=> a.cat === cat && audOk(a, tab)).length; }

/* ---------------------------------------------------------------------
   4. CHỈ MỤC ĐẢO NGƯỢC + TÌM KIẾM KHÔNG DẤU
   --------------------------------------------------------------------- */
function buildIndex(){
  const map = new Map(), docs = new Map();
  const add = (key, text, w)=>{
    const cnt = new Map(); tokens(text).forEach(t=> cnt.set(t, (cnt.get(t) || 0) + 1));
    cnt.forEach((n, t)=>{ let p = map.get(t); if(!p){ p = new Map(); map.set(t, p); } p.set(key, (p.get(key) || 0) + w * (1 + Math.log(n))); });
  };
  const flat = s=> " " + fold(s).replace(/[^a-z0-9]+/g, " ").trim() + " ";
  ARTS.forEach(a=>{
    const k = "a:" + a.id; docs.set(k, { type:"a", item:a, ft: flat(a.title), fa: flat(a.title + " " + a.summary + " " + a.tags.join(" ") + " " + a.plain) });
    add(k, a.title, 6); add(k, a.tags.join(" · "), 4); add(k, a.summary, 3); add(k, (CAT[a.cat] || {}).label, 1.5);
    add(k, a.toc.map(t=> t.text).join(" · "), 2); add(k, a.plain, 1);
  });
  GLOSS.forEach((g, i)=>{ const k = "g:" + i; docs.set(k, { type:"g", item:g, ft: flat(g.t), fa: flat(g.t + " " + g.en + " " + g.d) }); add(k, g.t, 6); add(k, g.en, 3); add(k, g.d, 1); });
  FAQ.forEach((f, i)=>{ const k = "f:" + i; docs.set(k, { type:"f", item:f, ft: flat(f.q), fa: flat(f.q + " " + f.a) }); add(k, f.q, 4); add(k, f.a, 1); });
  IDX = { map, docs, vocab: [...map.keys()].sort() };
  return IDX;
}
function ensureIndex(){ return IDX || buildIndex(); }
function prefixTokens(p, limit){
  const v = IDX.vocab; let lo = 0, hi = v.length;
  while(lo < hi){ const mid = (lo + hi) >> 1; if(v[mid] < p) lo = mid + 1; else hi = mid; }
  const out = []; for(let i = lo; i < v.length && out.length < (limit || 60); i++){ if(!v[i].startsWith(p)) break; if(v[i] !== p) out.push(v[i]); }
  return out;
}
function search(qs, opts){
  opts = opts || {};
  ensureIndex();
  const raw = String(qs == null ? "" : qs);
  let qt = tokens(raw); if(!qt.length) qt = tokens(raw, true);
  const empty = { q: raw, tokens: [], partial:false, articles:[], glossary:[], faq:[], total:0 };
  if(!qt.length) return empty;
  qt = uniq(qt).slice(0, 8);
  const prefixLast = !/\s$/.test(raw);
  const per = qt.map((t, i)=>{
    const res = new Map();
    const post = (tok, mult)=>{ const p = IDX.map.get(tok); if(p) p.forEach((s, k)=>{ const v = s * mult; if(v > (res.get(k) || 0)) res.set(k, v); }); };
    post(t, 1);
    (SYN[t] || []).forEach(s=> post(s, 0.7));
    if(i === qt.length - 1 && prefixLast && t.length >= 2) prefixTokens(t).forEach(p=> post(p, 0.55));
    return res;
  });
  let keys = [...per[0].keys()].filter(k=> per.every(m=> m.has(k)));
  let partial = false;
  if(!keys.length && per.length > 1){ partial = true; keys = uniq(per.flatMap(m=> [...m.keys()])); }
  const phrase = " " + qt.join(" ") + " ";
  const scored = keys.map(k=>{
    const d = IDX.docs.get(k); let s = 0, hit = 0;
    per.forEach(m=>{ if(m.has(k)){ s += m.get(k); hit++; } });
    if(partial) s *= hit / per.length;
    if(qt.length > 1){ if(d.ft.includes(phrase)) s += 14; else if(d.fa.includes(phrase)) s += 6; }
    else if(d.ft.includes(" " + qt[0] + " ")) s += 4;
    if(d.ft.startsWith(phrase)) s += 8;            // tiêu đề bắt đầu đúng cụm tìm kiếm
    return { k, s, d, hit };
  }).filter(x=> x.s > 0);
  scored.sort((a, b)=> b.s - a.s);
  const tab = opts.tab || "all";
  const articles = scored.filter(x=> x.d.type === "a" && audOk(x.d.item, tab)).map(x=> ({ type:"a", id:x.d.item.id, score: +x.s.toFixed(2), item:x.d.item }));
  const glossary = scored.filter(x=> x.d.type === "g").map(x=> ({ type:"g", score: +x.s.toFixed(2), item:x.d.item }));
  const faq = scored.filter(x=> x.d.type === "f" && (tab === "all" || x.d.item.aud === "ca-hai" || x.d.item.aud === tab)).map(x=> ({ type:"f", score: +x.s.toFixed(2), item:x.d.item }));
  return { q: raw, tokens: qt, partial, articles, glossary, faq, total: articles.length + glossary.length + faq.length };
}
/* Đoạn trích có tô sáng: dò trên chuỗi đã bỏ dấu (cùng độ dài), cắt & escape trên chuỗi gốc */
function snippet(text, qt, len){
  len = len || 150; text = String(text || "").normalize("NFC");
  const f = fold(text); if(f.length !== text.length) return esc(text.slice(0, len)) + (text.length > len ? "…" : "");
  const re = new RegExp("(^|[^a-z0-9])(" + qt.map(t=> t.replace(/[^a-z0-9]/g, "")).filter(Boolean).join("|") + ")", "g");
  const m = qt.length ? re.exec(f) : null;
  let start = 0; if(m) start = Math.max(0, m.index - 40);
  if(start > 0){ const sp = text.indexOf(" ", start); if(sp > 0 && sp - start < 20) start = sp + 1; }
  const end = Math.min(text.length, start + len);
  const seg = text.slice(start, end), fs = f.slice(start, end);
  const marks = []; let mm; const re2 = new RegExp(re.source, "g");
  while(qt.length && (mm = re2.exec(fs))){ const s0 = mm.index + mm[1].length; let e0 = s0 + mm[2].length; while(e0 < fs.length && /[a-z0-9]/.test(fs[e0])) e0++; marks.push([s0, e0]); if(re2.lastIndex === mm.index) re2.lastIndex++; }
  let html = "", pos = 0; marks.forEach(([s0, e0])=>{ if(s0 < pos) return; html += esc(seg.slice(pos, s0)) + "<mark>" + esc(seg.slice(s0, e0)) + "</mark>"; pos = e0; });
  html += esc(seg.slice(pos));
  return (start > 0 ? "…" : "") + html + (end < text.length ? "…" : "");
}

/* ---------------------------------------------------------------------
   5. GỢI Ý · KIẾN THỨC HÔM NAY · BÀI LIÊN QUAN
   --------------------------------------------------------------------- */
function isRead(id){ return !!st().read[id]; }
function isSaved(id){ return st().saved.includes(id); }
function recommend(n, opts){
  opts = opts || {};
  const s = ST() || {}, p = s.profile || {}, goal = p.goal, pt = opts.pt != null ? !!opts.pt : isPT();
  const logs = Object.keys(s.workoutLog || {}).length;
  const w = {}; const add = (c, v)=>{ w[c] = (w[c] || 0) + v; };
  if(goal === "lose"){ add("giam-mo", 4); add("dinh-duong", 3); add("cardio", 2); }
  else if(goal === "gain"){ add("tang-co", 4); add("dinh-duong", 3); add("ky-thuat", 1.5); }
  else { add("phuc-hoi", 2); add("tam-ly", 2); add("dinh-duong", 1.5); add("cardio", 1); }
  if(logs < 6){ add("bat-dau", 3); add("ky-thuat", 2); }
  if(p.gender === "female") add("phu-nu", 2.5);
  if(pt) CATS.filter(c=> c.aud === "pt").forEach(c=> add(c.id, 4));
  const seed = opts.seed || todayKey();
  const L = ARTS.filter(a=> pt || a.audience !== "pt").map(a=> ({ a, s: (w[a.cat] || 0) + (isRead(a.id) ? -6 : 1.5) + hash01(seed + "|" + a.id) * 1.2 }));
  L.sort((x, y)=> y.s - x.s);
  return L.slice(0, n || 4).map(x=> x.a);
}
function todayPick(){
  const d = todayKey();
  if(C.today && C.today.date === d && BY_ID[C.today.id]) return BY_ID[C.today.id];
  const a = recommend(1, { seed: "today:" + d })[0] || null;
  C.today = a ? { date: d, id: a.id } : null;
  return a;
}
function related(a, n){
  if(!a) return [];
  const tags = new Set(a.tags.map(t=> fold(t))), ex = new Set(a.links.ex);
  return ARTS.filter(b=> b.id !== a.id).map(b=>{
    let s = 0;
    if(b.cat === a.cat) s += 3;
    b.tags.forEach(t=>{ if(tags.has(fold(t))) s += 2; });
    b.links.ex.forEach(x=>{ if(ex.has(x)) s += 0.6; });
    if(a.links.kb.includes(b.id)) s += 4;
    if(b.links.kb.includes(a.id)) s += 3;
    if((a.audience === "pt") !== (b.audience === "pt") && b.audience !== "ca-hai") s -= 1.5;
    return { b, s };
  }).filter(x=> x.s > 1).sort((x, y)=> y.s - x.s || x.b.id.localeCompare(y.b.id)).slice(0, n || 4).map(x=> x.b);
}
/* Bài liên quan tới 1 bài tập: ưu tiên bài có tên bài tập trong tiêu đề, bài kỹ thuật, bài nhắc nhiều lần */
function forExercise(exId, n){
  exId = cleanIdUnderscore(exId); if(!exId) return [];
  const m = EXS()[exId] || {};
  const kw = new Set(tokens(m.name || "").filter(t=> t.length >= 4).concat(exId.length >= 4 ? [exId] : []));
  return ARTS.filter(a=> a.links.ex.includes(exId)).map(a=>{
    const tt = tokens(a.title); const inTitle = tt.some(t=> kw.has(t));
    const mentions = (a.body.match(new RegExp("\\[\\[ex:" + exId + "[\\]|]", "gi")) || []).length;
    return { a, s: (inTitle ? 5 : 0) + (a.cat === "ky-thuat" ? 3 : 0) + (a.ex[0] === exId ? 1.5 : 0) + Math.min(3, mentions) * 0.7 + (a.audience === "pt" ? -2 : 0) };
  }).sort((x, y)=> y.s - x.s || x.a.id.localeCompare(y.a.id)).slice(0, n || 3).map(x=> x.a);
}
function topTags(list, n){
  const m = new Map(); list.forEach(a=> a.tags.forEach(t=>{ const k = fold(t); const e = m.get(k) || { t, n:0 }; e.n++; m.set(k, e); }));
  return [...m.values()].filter(e=> e.n >= 2).sort((x, y)=> y.n - x.n || x.t.localeCompare(y.t, "vi")).slice(0, n || 18);
}

/* ---------------------------------------------------------------------
   6. TRẠNG THÁI GIAO DIỆN + ĐIỀU HƯỚNG TRONG KHO
   --------------------------------------------------------------------- */
const C = { mounted:false, prev:"home", stack:[], today:null, mem:null, readMarked:{}, searchT:0, scrollBound:false, raf:0, explore:false, wrapped:[] };
let U = { view:"home", tab:null, cat:null, id:null, tag:null, q:"", gq:"" };
function curTab(){ return U.tab || st().tab || (isPT() ? "pt" : "nguoi-tap"); }
function isActive(){ const s = D && D.getElementById ? D.getElementById("screen-kb") : null; return !!(s && C.mounted && s.classList && s.classList.contains("active")); }

function ensureScreen(){
  if(C.mounted) return true;
  const host = q("#app-scroll"); if(!host) return false;
  if(!D.getElementById("kb-content") || !q("#screen-kb .kb-topbar")){
    host.insertAdjacentHTML("beforeend", `
    <section id="screen-kb" class="screen kb-screen" aria-label="Kho kiến thức TapEasy">
      <div class="topbar kb-topbar">
        <button class="icon-btn" id="kb-back" aria-label="Quay lại">${ic("arrow_back")}</button>
        <div class="logo kb-logo" id="kb-title">Kho kiến thức</div>
        <button class="icon-btn" id="kb-saved-btn" aria-label="Bài đã lưu">${ic("kb_bookmark")}</button>
        <div class="kb-progress" aria-hidden="true"><i id="kb-progress-bar"></i></div>
      </div>
      <div class="content kb-content" id="kb-content"></div>
    </section>`);
  }
  C.mounted = true;
  try{ if(typeof SUB_SCREENS !== "undefined" && Array.isArray(SUB_SCREENS) && !SUB_SCREENS.includes("kb")) SUB_SCREENS.push("kb"); }catch(e){}
  const back = D.getElementById("kb-back"); if(back) back.addEventListener("click", ()=> backNav());
  const sv = D.getElementById("kb-saved-btn"); if(sv) sv.addEventListener("click", ()=> nav({ view:"saved" }));
  const el = D.getElementById("kb-content");
  if(el){ el.addEventListener("click", onClick); el.addEventListener("input", onInput); el.addEventListener("keydown", onKey); }
  if(!C.scrollBound){ const sc = q("#app-scroll"); if(sc){ sc.addEventListener("scroll", onScroll, { passive:true }); C.scrollBound = true; } }
  return true;
}
function snapshot(){ return { view:U.view, cat:U.cat, id:U.id, tag:U.tag, q:U.q, gq:U.gq }; }
function nav(next, opt){
  opt = opt || {};
  if(isActive() && !opt.replace) C.stack.push(snapshot());
  U = Object.assign({ view:"home", cat:null, id:null, tag:null, q:"", gq:"" }, { tab: U.tab }, next || {});
  if(!isActive()){ if(!opt.keepStack) C.stack = opt.stack || []; if(typeof goto === "function") goto("kb"); else render(); }
  else { render(); scrollTop(); }
  return true;
}
function backNav(){
  if(C.stack.length){ const s = C.stack.pop(); U = Object.assign({}, U, s); render(); scrollTop(); return true; }
  const p = C.prev && C.prev !== "kb" ? C.prev : "home";
  try{ goto(p); }catch(e){ warn(e); }
  return true;
}
function scrollTop(){ try{ const sc = q("#app-scroll"); if(sc && sc.scrollTo) sc.scrollTo(0, 0); }catch(e){} }

/* ---------------------------------------------------------------------
   7. GIAO DIỆN (HTML)
   --------------------------------------------------------------------- */
const gradStyle = c=> `--g1:${c.g[0]};--g2:${c.g[1]}`;
function cardHTML(a, opt){
  opt = opt || {}; const c = CAT[a.cat] || CATS[0];
  const flags = [isRead(a.id) ? `<span class="kb-flag kb-flag--read">${ic("kb_check")}Đã đọc</span>` : "", isSaved(a.id) ? `<span class="kb-flag">${ic("kb_bookmark_on")}Đã lưu</span>` : "",
    a.origin !== "builtin" ? `<span class="kb-flag">${ic("kb_pen")}${a.origin === "custom" ? "Bài mới" : "Đã cập nhật"}</span>` : ""].join("");
  return `<button type="button" class="kb-card${isRead(a.id) ? " is-read" : ""}" data-kb-open="${a.id}" style="${gradStyle(c)}">
    <span class="kb-card-cat">${ic(c.icon)}${esc(c.label)}</span>
    <b class="kb-card-t">${esc(a.title)}</b>
    ${opt.snippet ? `<span class="kb-card-s kb-snip">${opt.snippet}</span>` : `<span class="kb-card-s">${esc(a.summary)}</span>`}
    <span class="kb-card-m">${ic("schedule")}${a.minutes} phút đọc · ${esc(AUDS[a.audience])}${flags}</span>
  </button>`;
}
function tabsHTML(){
  const t = curTab();
  return `<div class="seg kb-tabs" role="tablist" aria-label="Đối tượng">${TABS.map(([id, l])=> `<button type="button" role="tab" aria-selected="${t === id}" class="${t === id ? "active" : ""}" data-kb-tab="${id}">${l}</button>`).join("")}</div>`;
}
function homeHTML(){
  const tab = curTab(), vis = ARTS.filter(a=> audOk(a, tab));
  const today = (()=>{ const a = todayPick(); return a && audOk(a, tab) ? a : null; })();   // vòng 3: ô "Kho kiến thức" ở Trang chủ mở trang này
  const rec = recommend(4, { pt: tab === "pt" ? true : tab === "nguoi-tap" ? false : null }).filter(a=> !today || a.id !== today.id);
  const recent = st().recent.map(byId).filter(a=> a && audOk(a, tab) && !isRead(a.id)).slice(0, 3);
  const tags = topTags(vis, 18);
  const editor = can("kb.edit") || can("kb.publish");
  const custom = Object.values(st().custom || {});
  const pending = custom.filter(c=> c && (c.status === "draft" || c.status === "review")).length;
  return `
  <section class="kb-hero fk-dark-island">
    <div class="kb-hero-ic">${ic("kb_book")}</div>
    <h2>Kho kiến thức TapEasy</h2>
    <p>${ARTS.length} bài · ${GLOSS.length} thuật ngữ · ${FAQ.length} hỏi đáp. Biên soạn theo ACSM, NSCA, WHO, ISSN, Viện Dinh dưỡng và các tổng quan hệ thống.</p>
    <label class="kb-search" role="search">${ic("search")}<input id="kb-q" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="Tìm: đạm, squat, đau gối, hop dong…" aria-label="Tìm trong kho kiến thức (gõ có dấu hoặc không dấu)" value="${esc(U.q)}"><button type="button" class="kb-q-clear" data-kb-act="clear-q" aria-label="Xoá tìm kiếm"${U.q ? "" : " hidden"}>${ic("close")}</button></label>
  </section>
  ${tabsHTML()}
  <div id="kb-results" class="kb-results"${U.q.trim() ? "" : " hidden"}>${U.q.trim() ? resultsHTML(U.q) : ""}</div>
  <div id="kb-home-body"${U.q.trim() ? " hidden" : ""}>
    ${today ? `<div class="kb-sec kb-today"><h3>${ic("kb_spark")}Kiến thức hôm nay</h3><small>${isRead(today.id) ? "Đã đọc" : "Bài mới mỗi ngày"}</small></div>
    <div class="kb-list">${cardHTML(today)}</div>` : ""}
    ${rec.length ? `<div class="kb-sec"><h3>${ic("kb_spark")}Dành cho bạn</h3><small>${esc(recLabel(tab))}</small></div>
    <div class="kb-rail">${rec.map(a=> cardHTML(a)).join("")}</div>` : ""}
    <div class="kb-sec"><h3>${ic("kb_toc")}Chuyên mục</h3><small>${vis.length} bài</small></div>
    <div class="kb-cats">${catsFor(tab).map((c, i)=> `<button type="button" class="kb-cat fk-dark-island" data-kb-cat="${c.id}" style="${gradStyle(c)};--i:${i}">
        <span class="kb-cat-art" aria-hidden="true">${ic(c.icon)}</span><span class="kb-cat-ic">${ic(c.icon)}</span>
        <b>${esc(c.label)}</b><small>${countIn(c.id, tab)} bài</small></button>`).join("")}</div>
    <div class="kb-quick">
      <button type="button" class="kb-qbtn" data-kb-view="glossary">${ic("kb_az")}<b>Thuật ngữ A–Z</b><small>${GLOSS.length} mục</small></button>
      <button type="button" class="kb-qbtn" data-kb-view="faq">${ic("kb_quiz")}<b>Hỏi đáp nhanh</b><small>${FAQ.length} câu</small></button>
      <button type="button" class="kb-qbtn" data-kb-view="saved">${ic("kb_bookmark")}<b>Đã lưu</b><small>${st().saved.filter(byId).length} bài</small></button>
    </div>
    ${recent.length ? `<div class="kb-sec"><h3>${ic("kb_book")}Đọc tiếp</h3></div><div class="kb-list">${recent.map(a=> cardHTML(a)).join("")}</div>` : ""}
    ${tags.length ? `<div class="kb-sec"><h3>${ic("kb_tag")}Chủ đề nổi bật</h3></div><div class="kb-tags">${tags.map(t=> `<button type="button" class="pill kb-tag" data-kb-tag="${esc(t.t)}">#${esc(t.t)} <small>${t.n}</small></button>`).join("")}</div>` : ""}
    ${editor ? `<div class="kb-ed-bar">${can("kb.edit") ? `<button type="button" class="btn btn-outline btn-sm" data-kb-act="new">${ic("add")}Bài mới</button>` : ""}
      <button type="button" class="btn btn-ghost btn-sm" data-kb-view="drafts">${ic("kb_pen")}Bản nháp &amp; chờ duyệt${pending ? ` <i class="cnt">${pending}</i>` : ""}</button></div>` : ""}
    <p class="kb-disclaimer">Nội dung mang tính giáo dục, không thay thế chẩn đoán hay điều trị của bác sĩ. Khi có bệnh lý, đang mang thai hoặc chấn thương, hãy hỏi chuyên gia y tế trước khi tập.</p>
  </div>`;
}
function recLabel(tab){
  const p = (ST() || {}).profile || {};
  if(tab === "pt" || (tab !== "nguoi-tap" && isPT())) return "Theo vai trò PT của bạn";
  return p.goal === "lose" ? "Theo mục tiêu Giảm mỡ" : p.goal === "gain" ? "Theo mục tiêu Tăng cơ" : "Theo hồ sơ của bạn";
}
function resultsHTML(qs){
  const r = search(qs, { tab: curTab() });
  const n = r.total;
  if(!n) return `<div class="kb-empty">${ic("search")}<b>Không tìm thấy "${esc(qs)}"</b><small>Thử từ khác ngắn hơn, ví dụ "đạm", "gối", "giá". Gõ có dấu hay không dấu đều được.</small>${curTab() !== "all" ? `<button type="button" class="btn btn-outline btn-sm" data-kb-tab="all">Tìm trong Tất cả</button>` : ""}</div>`;
  return `<p class="kb-count" role="status">${n} kết quả cho "<b>${esc(qs)}</b>"${r.partial ? " · khớp một phần" : ""}</p>
    ${r.articles.length ? `<div class="kb-sec"><h3>${ic("kb_book")}Bài viết</h3><small>${r.articles.length}</small></div><div class="kb-list">${r.articles.slice(0, 30).map(x=> cardHTML(x.item, { snippet: snippet(x.item.summary + " " + x.item.plain, r.tokens) })).join("")}</div>` : ""}
    ${r.glossary.length ? `<div class="kb-sec"><h3>${ic("kb_az")}Thuật ngữ</h3><small>${r.glossary.length}</small></div><dl class="kb-terms">${r.glossary.slice(0, 8).map(x=> termHTML(x.item)).join("")}</dl>` : ""}
    ${r.faq.length ? `<div class="kb-sec"><h3>${ic("kb_quiz")}Hỏi đáp</h3><small>${r.faq.length}</small></div><div class="kb-faqs">${r.faq.slice(0, 8).map(x=> faqHTML(x.item)).join("")}</div>` : ""}`;
}
function termHTML(g){
  const a = g.kb && byId(g.kb);
  return `<div class="kb-term"><dt>${esc(g.t)}${g.en ? ` <small lang="en">${esc(g.en)}</small>` : ""}</dt><dd>${esc(g.d)}${a ? ` <a href="#kb/${a.id}" class="kb-alink" data-kb-open="${a.id}">Đọc bài</a>` : ""}</dd></div>`;
}
function faqHTML(f){
  const a = f.kb && byId(f.kb);
  return `<details class="kb-faq"><summary><span>${esc(f.q)}</span>${ic("chevron_right")}</summary><div><p>${esc(f.a)}</p>${a ? `<a href="#kb/${a.id}" class="kb-alink" data-kb-open="${a.id}">${ic("kb_book")}Đọc thêm: ${esc(a.title)}</a>` : ""}</div></details>`;
}
function catHTML(){
  const c = CAT[U.cat] || CATS[0], tab = curTab();
  let list = ARTS.filter(a=> a.cat === c.id);
  const vis = list.filter(a=> audOk(a, tab)); if(vis.length) list = vis;
  const tags = topTags(list, 12);
  const shown = U.tag ? list.filter(a=> a.tags.some(t=> fold(t) === fold(U.tag))) : list;
  const unread = list.filter(a=> !isRead(a.id)).length;
  return `<section class="kb-cat-hero fk-dark-island" style="${gradStyle(c)}">
      <span class="kb-cat-art" aria-hidden="true">${ic(c.icon)}</span>
      <span class="kb-cat-ic">${ic(c.icon)}</span>
      <h2>${esc(c.label)}</h2><p>${esc(c.desc)}</p>
      <small>${list.length} bài · ${unread} chưa đọc · ${c.aud === "pt" ? "Dành cho PT" : "Dành cho người tập"}</small>
    </section>
    ${tags.length ? `<div class="kb-tags">${tags.map(t=> `<button type="button" class="pill kb-tag${U.tag && fold(U.tag) === fold(t.t) ? " active" : ""}" data-kb-tag="${esc(t.t)}" aria-pressed="${!!(U.tag && fold(U.tag) === fold(t.t))}">#${esc(t.t)}</button>`).join("")}</div>` : ""}
    <div class="kb-list">${shown.map(a=> cardHTML(a)).join("") || `<p class="empty-hint">Chưa có bài với thẻ này.</p>`}</div>`;
}
function tagHTML(){
  const tab = curTab(), t = U.tag || "";
  const list = ARTS.filter(a=> audOk(a, tab) && a.tags.some(x=> fold(x) === fold(t)));
  return `<div class="kb-sec kb-sec--big"><h2>${ic("kb_tag")}#${esc(t)}</h2><small>${list.length} bài</small></div>
    ${tabsHTML()}
    <div class="kb-list">${list.map(a=> cardHTML(a)).join("") || `<p class="empty-hint">Chưa có bài phù hợp trong tab này.</p>`}</div>`;
}
function articleHTML(a){
  const c = CAT[a.cat] || CATS[0], s = st();
  const exs = a.links.ex.filter(x=> EXS()[x]).slice(0, 12), tpls = a.links.tpl.filter(findTpl).slice(0, 6);
  const rel = related(a, 4);
  const sib = ARTS.filter(b=> b.cat === a.cat), si = sib.findIndex(b=> b.id === a.id);
  const prev = si > 0 ? sib[si - 1] : null, next = si >= 0 && si < sib.length - 1 ? sib[si + 1] : null;
  const custom = s.custom[a.id];
  return `<article class="kb-art" data-id="${a.id}" aria-labelledby="kb-h1">
    <header class="kb-art-hero fk-dark-island" style="${gradStyle(c)}">
      <span class="kb-cat-art" aria-hidden="true">${ic(c.icon)}</span>
      <button type="button" class="kb-crumb" data-kb-cat="${c.id}">${ic(c.icon)}${esc(c.label)}</button>
      <h1 id="kb-h1">${esc(a.title)}</h1>
      <p class="kb-lead">${esc(a.summary)}</p>
      <div class="kb-meta">${ic("schedule")}<span>${a.minutes} phút đọc</span><span>·</span><span>${esc(AUDS[a.audience])}</span>${a.updated ? `<span>·</span><span>Cập nhật ${fmtDate(a.updated)}</span>` : ""}</div>
    </header>
    <div class="kb-actions" role="toolbar" aria-label="Thao tác với bài">
      <button type="button" class="kb-act${isSaved(a.id) ? " on" : ""}" data-kb-act="save" aria-pressed="${isSaved(a.id)}">${ic(isSaved(a.id) ? "kb_bookmark_on" : "kb_bookmark")}<span>${isSaved(a.id) ? "Đã lưu" : "Lưu bài"}</span></button>
      <button type="button" class="kb-act${isRead(a.id) ? " on" : ""}" data-kb-act="read" aria-pressed="${isRead(a.id)}">${ic("kb_check")}<span>${isRead(a.id) ? "Đã đọc" : "Đánh dấu đã đọc"}</span></button>
      <button type="button" class="kb-act" data-kb-act="share">${ic("kb_share")}<span>Chia sẻ</span></button>
      <button type="button" class="kb-act" data-kb-act="font" aria-label="Đổi cỡ chữ (hiện: ${["nhỏ","vừa","lớn"][s.fs]})">${ic("kb_text")}<span>Cỡ chữ</span></button>
      ${can("kb.edit") ? `<button type="button" class="kb-act" data-kb-act="edit">${ic("kb_pen")}<span>Sửa</span></button>` : ""}
      ${can("kb.publish") && custom ? `<button type="button" class="kb-act" data-kb-act="revert">${ic("kb_trash")}<span>${a.origin === "custom" ? "Gỡ bài" : "Bỏ bản sửa"}</span></button>` : ""}
    </div>
    ${a.toc.length >= 2 ? `<nav class="kb-toc" aria-label="Mục lục"><b>${ic("kb_toc")}Mục lục</b><ol>${a.toc.map(t=> `<li><a href="#${esc(t.id)}" data-kb-toc="${esc(t.id)}">${esc(plainInline(t.text))}</a></li>`).join("")}</ol></nav>` : ""}
    <div class="kb-body kb-fs-${s.fs}">${renderBlocks(a.blocks)}</div>
    ${exs.length ? `<section class="kb-links"><h2>${ic("fitness_center")}Bài tập trong bài viết</h2><div class="kb-chips">${exs.map(x=>{ const m = EXS()[x]; return `<button type="button" class="kb-exc" data-ex="${x}"><b>${esc(shortEx(m.name))}</b><small>${esc(m.muscle || "")}${m.equipment ? " · " + esc(m.equipment) : ""}</small></button>`; }).join("")}</div></section>` : ""}
    ${tpls.length ? `<section class="kb-links"><h2>${ic("school")}Giáo án mẫu liên quan</h2><div class="kb-chips">${tpls.map(id=>{ const t = findTpl(id); return `<button type="button" class="kb-exc kb-exc--tpl" data-tpl="${id}"><b>${esc(t.name)}</b><small>${t.perWeek ? esc(t.perWeek) + " buổi/tuần" : ""}${t.weeks ? " · " + esc(t.weeks) + " tuần" : ""}</small></button>`; }).join("")}</div></section>` : ""}
    <section class="kb-src"><h2>${ic("kb_source")}Nguồn tham khảo</h2><ol>${a.sources.map(srcHTML).join("")}</ol></section>
    <p class="kb-disclaimer">Bài viết mang tính giáo dục, không thay thế tư vấn y tế. ${a.origin !== "builtin" && a.by ? "Biên tập: " + esc(a.by) + ". " : ""}Phát hiện thông tin chưa chính xác? Hãy báo cho đội ngũ TapEasy.</p>
    ${prev || next ? `<nav class="kb-nextprev" aria-label="Bài cùng chuyên mục">${prev ? `<button type="button" data-kb-open="${prev.id}" data-kb-replace="1"><small>${ic("arrow_back")}Bài trước</small><b>${esc(prev.title)}</b></button>` : "<span></span>"}${next ? `<button type="button" data-kb-open="${next.id}" data-kb-replace="1" class="nx"><small>Bài tiếp${ic("chevron_right")}</small><b>${esc(next.title)}</b></button>` : ""}</nav>` : ""}
    ${rel.length ? `<section class="kb-related"><h2>${ic("kb_spark")}Bài liên quan</h2><div class="kb-list">${rel.map(b=> cardHTML(b)).join("")}</div></section>` : ""}
  </article>`;
}
function srcHTML(s){
  const link = s.u ? `<a href="${esc(s.u)}" target="_blank" rel="noopener noreferrer">Mở nguồn</a>`
    : `<a href="https://scholar.google.com/scholar?q=${encodeURIComponent(s.t.slice(0, 220))}" target="_blank" rel="noopener noreferrer">Tra cứu</a>`;
  return `<li>${esc(s.t)} ${link}</li>`;
}
function glossaryHTML(){
  return `<div class="kb-sec kb-sec--big"><h2>${ic("kb_az")}Thuật ngữ A–Z</h2><small>${GLOSS.length} mục</small></div>
    <label class="kb-search kb-search--sm">${ic("search")}<input id="kb-gq" type="search" autocomplete="off" placeholder="Lọc thuật ngữ: rir, đạm, zone…" aria-label="Lọc thuật ngữ" value="${esc(U.gq)}"></label>
    <div id="kb-gl-list">${glossListHTML(U.gq)}</div>`;
}
function glossListHTML(f){
  const ft = tokens(f || "", true);
  const L = ft.length ? GLOSS.filter(g=>{ const s = " " + fold(g.t + " " + g.en + " " + g.d).replace(/[^a-z0-9]+/g, " "); return ft.every(t=> s.includes(" " + t)); }) : GLOSS;
  const groups = {}; L.forEach(g=>{ const k = letterOf(g.t); (groups[k] = groups[k] || []).push(g); });
  const letters = Object.keys(groups).sort((a, b)=> a === "#" ? -1 : b === "#" ? 1 : a.localeCompare(b));
  if(!L.length) return `<p class="empty-hint">Không có thuật ngữ khớp "${esc(f)}".</p>`;
  return `<nav class="kb-az" aria-label="Chữ cái">${letters.map(l=> `<button type="button" data-kb-letter="${l}" aria-label="Đến chữ ${l}">${l}</button>`).join("")}</nav>
    ${letters.map(l=> `<section class="kb-gl-group" id="kb-L-${l === "#" ? "num" : l}"><h3>${l}</h3><dl class="kb-terms">${groups[l].map(termHTML).join("")}</dl></section>`).join("")}`;
}
function faqViewHTML(){
  const tab = curTab();
  const L = FAQ.filter(f=> tab === "all" || f.aud === "ca-hai" || f.aud === tab);
  return `<div class="kb-sec kb-sec--big"><h2>${ic("kb_quiz")}Hỏi đáp nhanh</h2><small>${L.length} câu</small></div>${tabsHTML()}<div class="kb-faqs">${L.map(faqHTML).join("")}</div>`;
}
function savedHTML(){
  const s = st(); const saved = s.saved.map(byId).filter(Boolean);
  const read = Object.keys(s.read).sort((x, y)=> s.read[y] - s.read[x]).map(byId).filter(Boolean).slice(0, 10);
  return `<div class="kb-sec kb-sec--big"><h2>${ic("kb_bookmark")}Đã lưu</h2><small>${saved.length} bài</small></div>
    <div class="kb-list">${saved.map(a=> cardHTML(a)).join("") || (typeof fkEmpty === "function" ? fkEmpty("kb_bookmark", "Chưa lưu bài nào", "Bấm \"Lưu bài\" trong trang đọc để đọc lại sau.") : `<p class="empty-hint">Chưa lưu bài nào. Bấm "Lưu bài" trong trang đọc để đọc lại sau.</p>`)}</div>
    ${read.length ? `<div class="kb-sec"><h3>${ic("kb_check")}Đã đọc gần đây</h3><small>${Object.keys(s.read).length} bài đã đọc</small></div><div class="kb-list">${read.map(a=> cardHTML(a)).join("")}</div>` : ""}`;
}
function draftsHTML(){
  if(!can("kb.edit") && !can("kb.publish")) return `<p class="empty-hint">Bạn cần quyền biên tập để xem mục này.</p>`;
  const L = Object.values(st().custom || {}).filter(Boolean).sort((a, b)=> (b.updatedAt || 0) - (a.updatedAt || 0));
  return `<div class="kb-sec kb-sec--big"><h2>${ic("kb_pen")}Bản nháp &amp; chờ duyệt</h2><small>${L.length} bài</small></div>
    ${can("kb.edit") ? `<button type="button" class="btn btn-primary btn-block" data-kb-act="new">${ic("add")}Viết bài mới</button>` : ""}
    <div class="kb-drafts">${L.map(c=>{ const id = cleanId(c.id); return `<div class="kb-draft">
      <div><b>${esc(c.title || id)}</b><small>${esc(STATUS[c.status] || c.status || "")}${c.hidden ? " · đang ẩn" : ""}${c.by ? " · " + esc(c.by) : ""}${c.updatedAt ? " · " + esc(new Date(c.updatedAt).toLocaleDateString("vi-VN")) : ""}</small></div>
      <div class="kb-draft-a">${can("kb.edit") ? `<button type="button" class="btn btn-ghost btn-sm" data-kb-act="edit" data-id="${id}">Sửa</button>` : ""}
      ${can("kb.publish") ? `<button type="button" class="btn btn-outline btn-sm" data-kb-act="${c.status === "published" && !c.hidden ? "unpub" : "pub"}" data-id="${id}">${c.status === "published" && !c.hidden ? "Gỡ" : "Xuất bản"}</button>` : ""}</div></div>`; }).join("") || `<p class="empty-hint">Chưa có bản nháp.</p>`}</div>`;
}
function viewHTML(){
  switch(U.view){
    case "cat": return catHTML();
    case "tag": return tagHTML();
    case "article": { const a = byId(U.id); return a ? articleHTML(a) : `<div class="kb-empty">${ic("kb_info")}<b>Không tìm thấy bài viết</b><small>Bài có thể đã được gỡ hoặc đổi địa chỉ.</small><button type="button" class="btn btn-outline btn-sm" data-kb-view="home">Về Kho kiến thức</button></div>`; }
    case "glossary": return glossaryHTML();
    case "faq": return faqViewHTML();
    case "saved": return savedHTML();
    case "drafts": return draftsHTML();
    default: return homeHTML();
  }
}
function titleFor(){
  if(U.view === "article"){ const a = byId(U.id); return a ? (CAT[a.cat] || {}).label || "Bài viết" : "Bài viết"; }
  return { cat: (CAT[U.cat] || {}).label, tag: "Chủ đề", glossary: "Thuật ngữ A–Z", faq: "Hỏi đáp nhanh", saved: "Đã lưu", drafts: "Biên tập" }[U.view] || "Kho kiến thức";
}
function render(){
  try{
    if(!ensureScreen()) return "";
    const el = D.getElementById("kb-content"); if(!el) return "";
    if(DATA.st !== "ready"){                                   // fkLazy: đang tải / lỗi + Thử lại
      if(DATA.st === "idle") ensureData();
      const h0 = dataStateHTML(); el.innerHTML = h0;
      const t0 = D.getElementById("kb-title"); if(t0) t0.textContent = "Kho kiến thức";
      const s0 = D.getElementById("screen-kb"); if(s0 && s0.classList) s0.classList.remove("kb-reading");
      return h0;
    }
    const html = viewHTML();
    el.innerHTML = html;
    const t = D.getElementById("kb-title"); if(t) t.textContent = titleFor();
    const scr = D.getElementById("screen-kb"); if(scr && scr.classList) scr.classList.toggle("kb-reading", U.view === "article");
    setProgress(0);
    if(U.view === "article") C.readMarked[U.id] = isRead(U.id);
    return html;
  }catch(e){ warn("render", e); return ""; }
}

/* ---------------------------------------------------------------------
   8. HÀNH ĐỘNG: mở bài, lưu, đã đọc, chia sẻ, cỡ chữ, tiến độ đọc
   --------------------------------------------------------------------- */
function openArticle(id, opt){
  if(DATA.st !== "ready"){                                    // dữ liệu chưa nạp: mở màn (khung chờ) rồi vào bài khi xong
    const want = cleanId(id); if(!want) return false;
    if(!isActive()) nav({ view:"home" }, { stack: [] });
    whenReady(ok=>{ if(ok && byId(want)) openArticle(want, opt); });
    return true;
  }
  const a = byId(id); if(!a){ say("Không tìm thấy bài viết", "error"); return false; }
  const s = st(); s.recent = [a.id].concat(s.recent.filter(x=> x !== a.id)).slice(0, 12); persist();
  return nav({ view:"article", id:a.id }, opt);
}
function openCat(id){ if(!CAT[id]) return false; return nav({ view:"cat", cat:id }); }
function open(opts){
  opts = opts || {};
  if(opts.tab && (opts.tab === "all" || opts.tab === "pt" || opts.tab === "nguoi-tap")) U.tab = opts.tab;
  if(opts.id) return openArticle(opts.id);
  if(opts.cat) return openCat(opts.cat);
  return nav({ view: opts.view || "home", q: opts.q || "", tag: opts.tag || null }, { stack: [] });
}
function setTab(t){ if(!TABS.some(x=> x[0] === t)) return; U.tab = t; st().tab = t; persist(); render(); }
function toggleSave(id){
  const s = st(); id = cleanId(id); if(!byId(id)) return false;
  const on = !s.saved.includes(id);
  s.saved = on ? [id].concat(s.saved) : s.saved.filter(x=> x !== id); persist();
  say(on ? "Đã lưu bài — xem lại ở mục Đã lưu" : "Đã bỏ lưu", on ? "kb_bookmark_on" : "kb_bookmark");
  return on;
}
function setRead(id, on){
  const s = st(); id = cleanId(id); if(!byId(id)) return false;
  if(on == null) on = !s.read[id];
  if(on) s.read[id] = Date.now(); else delete s.read[id];
  persist();
  try{ if(typeof teHomeExplore !== "undefined" && teHomeExplore && teHomeExplore.refresh) teHomeExplore.refresh(); }catch(e){}
  return on;
}
function shareUrl(id){
  let base = "https://thangvu030198-ai.github.io/fitkit-app/";
  try{ if(G.location && /^https?:$/.test(G.location.protocol) && G.location.host) base = G.location.origin + G.location.pathname; }catch(e){}
  return base + "?kb=" + encodeURIComponent(cleanId(id));
}
async function share(id){
  const a = byId(id); if(!a) return "missing";
  const url = shareUrl(a.id), text = a.title + " — " + a.summary;
  try{ if(G.navigator && typeof G.navigator.share === "function"){ await G.navigator.share({ title: a.title + " · TapEasy", text, url }); return "shared"; } }
  catch(e){ if(e && e.name === "AbortError") return "cancel"; }
  try{ if(G.navigator && G.navigator.clipboard && G.navigator.clipboard.writeText){ await G.navigator.clipboard.writeText(text + "\n" + url); say("Đã sao chép liên kết bài viết", "content_copy"); return "copied"; } }catch(e){}
  try{ if(typeof openSheet === "function") openSheet(`<div class="sheet-header"><h3>Chia sẻ bài viết</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <p class="small-note">Sao chép liên kết dưới đây:</p><input class="kb-share-url" readonly value="${esc(url)}" aria-label="Liên kết bài viết" onfocus="this.select()">`); }catch(e){}
  return "manual";
}
function cycleFont(){ const s = st(); s.fs = (s.fs + 1) % 3; persist(); const b = q("#kb-content .kb-body"); if(b && b.className != null){ b.className = "kb-body kb-fs-" + s.fs; } else render(); say("Cỡ chữ: " + ["nhỏ","vừa","lớn"][s.fs], "kb_text"); return s.fs; }
function setProgress(p){ const bar = D.getElementById("kb-progress-bar"); if(bar && bar.style) bar.style.transform = "scaleX(" + Math.max(0, Math.min(1, p)).toFixed(3) + ")"; }
function onScroll(){
  if(U.view !== "article" || !isActive()) return;
  if(C.raf) return;
  const run = ()=>{ C.raf = 0; try{
    const body = q("#kb-content .kb-body"), sc = q("#app-scroll"); if(!body || !sc || !body.getBoundingClientRect) return;
    const r = body.getBoundingClientRect(), vh = sc.clientHeight || G.innerHeight || 800;
    const total = r.height - vh * 0.6; const done = Math.max(0, -r.top + vh * 0.25);
    const p = total > 0 ? Math.min(1, done / total) : 1; setProgress(p);
    if(p >= 0.92 && U.id && !C.readMarked[U.id]){ C.readMarked[U.id] = true; setRead(U.id, true);
      const btn = q('#kb-content [data-kb-act="read"]'); if(btn && btn.classList){ btn.classList.add("on"); btn.setAttribute("aria-pressed", "true"); const sp = btn.querySelector("span:last-child"); if(sp) sp.textContent = "Đã đọc"; } }
  }catch(e){} };
  if(typeof G.requestAnimationFrame === "function"){ C.raf = 1; G.requestAnimationFrame(run); } else run();
}

/* Bài tập / giáo án mẫu */
function openEx(id){
  const m = EXS()[id]; if(!m) return false;
  if(typeof openLibDetail === "function"){ try{ openLibDetail("fk:" + id); return true; }catch(e){ warn(e); } }
  if(typeof openSheet === "function") openSheet(`<div class="sheet-header"><h3>${esc(m.name)}</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <div class="chip-row"><span class="pill">${esc(m.muscle || "")}</span><span class="pill">${esc(m.equipment || "")}</span></div>
    <p class="small-note" style="line-height:1.6;margin-top:10px">${esc(m.guide || "")}</p>${exMoreHTML(id, true)}`);
  return true;
}
function openTpl(id){
  if(!findTpl(id)) return false;
  try{ if(typeof openTemplateDetail === "function"){ openTemplateDetail(id); return true; } if(typeof openTemplateBrowser === "function"){ openTemplateBrowser(); return true; } }catch(e){ warn(e); }
  return false;
}

/* ---------------------------------------------------------------------
   9. SỰ KIỆN (uỷ quyền trên #kb-content)
   --------------------------------------------------------------------- */
function onClick(e){
  const t = e && e.target && e.target.closest ? e.target.closest("[data-kb-open],[data-kb-cat],[data-kb-tab],[data-kb-tag],[data-ex],[data-tpl],[data-kb-act],[data-kb-toc],[data-kb-view],[data-kb-letter]") : null;
  if(!t) return;
  const d = t.dataset || {};
  if(d.kbOpen){ e.preventDefault(); openArticle(d.kbOpen, d.kbReplace ? { replace:true } : null); return; }
  if(d.kbCat){ openCat(d.kbCat); return; }
  if(d.kbTab){ setTab(d.kbTab); return; }
  if(d.kbTag){ if(U.view === "cat"){ U.tag = U.tag && fold(U.tag) === fold(d.kbTag) ? null : d.kbTag; render(); } else nav({ view:"tag", tag:d.kbTag }); return; }
  if(d.ex){ openEx(d.ex); return; }
  if(d.tpl){ openTpl(d.tpl); return; }
  if(d.kbView){ nav({ view:d.kbView }); return; }
  if(d.kbToc){ e.preventDefault(); const h = D.getElementById(d.kbToc); if(h && h.scrollIntoView) h.scrollIntoView({ behavior:"smooth", block:"start" }); return; }
  if(d.kbLetter){ const g = D.getElementById("kb-L-" + (d.kbLetter === "#" ? "num" : d.kbLetter)); if(g && g.scrollIntoView) g.scrollIntoView({ behavior:"smooth", block:"start" }); return; }
  if(d.kbAct) act(d.kbAct, d.id || U.id, t);
}
function act(a, id, btn){
  switch(a){
    case "save": { const on = toggleSave(id); if(btn && btn.classList){ btn.classList.toggle("on", on); btn.setAttribute("aria-pressed", String(on)); btn.innerHTML = `${ic(on ? "kb_bookmark_on" : "kb_bookmark")}<span>${on ? "Đã lưu" : "Lưu bài"}</span>`; } return on; }
    case "read": { const on = setRead(id); C.readMarked[id] = true; if(btn && btn.classList){ btn.classList.toggle("on", on); btn.setAttribute("aria-pressed", String(on)); btn.innerHTML = `${ic("kb_check")}<span>${on ? "Đã đọc" : "Đánh dấu đã đọc"}</span>`; } return on; }
    case "share": share(id); return true;
    case "font": return cycleFont();
    case "clear-q": U.q = ""; render(); { const i = D.getElementById("kb-q"); if(i && i.focus) i.focus(); } return true;
    case "new": return openEditor(null);
    case "edit": return openEditor(id);
    case "pub": return setPublished(id, true);
    case "unpub": return setPublished(id, false);
    case "revert": return revert(id, { confirm:true });
    case "retry": if(DATA.st === "error") DATA.st = "idle"; render(); return true;
  }
  return false;
}
function onInput(e){
  const t = e && e.target; if(!t) return;
  if(t.id === "kb-q"){
    U.q = String(t.value || "").slice(0, 120);
    clearTimeout(C.searchT);
    C.searchT = setTimeout(updateResults, 160);
  } else if(t.id === "kb-gq"){
    U.gq = String(t.value || "").slice(0, 80);
    const L = D.getElementById("kb-gl-list"); if(L) L.innerHTML = glossListHTML(U.gq);
  }
}
function updateResults(){
  const r = D.getElementById("kb-results"), b = D.getElementById("kb-home-body"), clr = q("#kb-content .kb-q-clear");
  const has = !!U.q.trim();
  if(r){ r.hidden = !has; r.innerHTML = has ? resultsHTML(U.q) : ""; }
  if(b) b.hidden = has;
  if(clr) clr.hidden = !U.q;
}
function onKey(e){ if(e && e.key === "Enter" && e.target && (e.target.id === "kb-q" || e.target.id === "kb-gq")){ e.preventDefault(); try{ e.target.blur(); }catch(_){} } }

/* ---------------------------------------------------------------------
   10. BIÊN TẬP (teCan("kb.edit")) · XUẤT BẢN (teCan("kb.publish"))
   --------------------------------------------------------------------- */
function editorName(){ try{ return (typeof cloud !== "undefined" && cloud.user && (cloud.user.name || cloud.user.email)) || ((ST() || {}).profile || {}).name || "Biên tập viên"; }catch(e){ return "Biên tập viên"; } }
function newId(title){
  let base = "u-" + slug(title).slice(0, 44), id = base, i = 2;
  while(RAW_BY_ID[id] || st().custom[id]) id = base + "-" + (i++);
  return id;
}
function validate(o){
  const err = [];
  if(!o.title || o.title.trim().length < 8) err.push("Tiêu đề cần ít nhất 8 ký tự.");
  if(!o.summary || o.summary.trim().length < 20) err.push("Tóm tắt cần ít nhất 20 ký tự.");
  if(!CAT[o.cat]) err.push("Chọn chuyên mục hợp lệ.");
  if(!AUDS[o.audience]) err.push("Chọn đối tượng hợp lệ.");
  if(!o.body || o.body.trim().length < 80) err.push("Nội dung cần ít nhất 80 ký tự.");
  const badEx = arr(o.ex).filter(x=> !EXS()[x]); if(badEx.length) err.push("Không có bài tập: " + badEx.join(", "));
  const badT = arr(o.tpl).filter(x=> !findTpl(x)); if(badT.length) err.push("Không có giáo án mẫu: " + badT.join(", "));
  if(!arr(o.sources).length) err.push("Cần ít nhất 1 nguồn tham khảo.");
  return err;
}
/* mode: "draft" | "review" | "publish". Trả về { ok, id, status, errors } */
function saveArticle(o, mode){
  if(!can("kb.edit") && !can("kb.publish")) return { ok:false, errors:["Bạn chưa có quyền biên tập (kb.edit)."] };
  o = Object.assign({}, o || {});
  o.title = String(o.title || "").trim().slice(0, 160); o.summary = String(o.summary || "").trim().slice(0, 400);
  o.body = String(o.body || "").slice(0, 40000);
  o.tags = uniq(arr(o.tags).map(t=> String(t).trim()).filter(Boolean)).slice(0, 12);
  o.ex = uniq(arr(o.ex).map(cleanIdUnderscore).filter(Boolean)); o.tpl = uniq(arr(o.tpl).map(cleanIdUnderscore).filter(Boolean));
  o.sources = arr(o.sources).map(normSrc).filter(Boolean).slice(0, 20);
  const errors = mode === "draft" ? (o.title.length >= 3 ? [] : ["Tiêu đề cần ít nhất 3 ký tự."]) : validate(o);
  if(errors.length) return { ok:false, errors };
  let id = cleanId(o.id); if(!SAFE_ID.test(id)) id = newId(o.title);
  const pub = mode === "publish";
  if(pub && !can("kb.publish")) return { ok:false, errors:["Xuất bản cần quyền kb.publish — đã lưu dạng chờ duyệt nếu bạn chọn Gửi duyệt."] };
  const prev = st().custom[id] || {};
  const status = pub ? "published" : (mode === "review" ? "review" : "draft");
  const rec = { id, title:o.title, summary:o.summary, audience: AUDS[o.audience] ? o.audience : "ca-hai", cat: CAT[o.cat] ? o.cat : "bat-dau", tags:o.tags, ex:o.ex, tpl:o.tpl,
    sources: o.sources, body:o.body, status, hidden:false, updated: todayKey(), updatedAt: Date.now(), by: editorName(), createdAt: prev.createdAt || Date.now() };
  st().custom[id] = rec; persist(); rebuild();
  audit(pub ? "kb.publish" : "kb.save", rec);
  remoteSave(rec);
  try{ G.dispatchEvent && G.dispatchEvent(new CustomEvent("tekb:change", { detail:{ id, status } })); }catch(e){}
  return { ok:true, id, status };
}
function setPublished(id, on){
  if(!can("kb.publish")){ say("Cần quyền xuất bản (kb.publish)", "lock"); return false; }
  id = cleanId(id); const s = st(); const base = s.custom[id] || (RAW_BY_ID[id] ? Object.assign({}, RAW_BY_ID[id]) : null);
  if(!base) return false;
  const rec = Object.assign({}, base, { id, status: on ? "published" : "draft", hidden: !on, updatedAt: Date.now(), by: editorName() });
  if(on && RAW_BY_ID[id] && !s.custom[id]){ return true; }
  s.custom[id] = rec; persist(); rebuild();
  audit(on ? "kb.publish" : "kb.unpublish", rec); remoteSave(rec);
  if(isActive()) render();
  say(on ? "Đã xuất bản" : "Đã gỡ khỏi kho (vẫn giữ bản nháp)", on ? "kb_publish" : "kb_trash");
  return true;
}
/* Xoá bản sửa (bài gốc trở lại) hoặc xoá hẳn bài mới. opts.confirm → hỏi lại bằng confirmDialog (giao diện) */
function revert(id, opts){
  if(!can("kb.publish")) return false;
  id = cleanId(id); const s = st(); if(!s.custom[id]) return false;
  const isNew = !RAW_BY_ID[id];
  const go = ()=>{ delete s.custom[id]; persist(); rebuild(); remoteDelete(id); audit(isNew ? "kb.delete" : "kb.revert", { id, title: id });
    if(isNew){ C.stack = C.stack.filter(x=> x.id !== id); if(U.id === id) U = Object.assign({}, U, { view:"home", id:null }); }
    if(isActive()) render(); say(isNew ? "Đã gỡ bài" : "Đã khôi phục bản gốc", "kb_trash"); };
  if(opts && opts.confirm && typeof confirmDialog === "function"){ confirmDialog(isNew ? "Gỡ bài này?" : "Bỏ bản sửa?", isNew ? "Bài sẽ bị xoá khỏi kho." : "Bài sẽ trở về nội dung gốc của TapEasy.", go, isNew ? "Gỡ bài" : "Khôi phục", "delete"); }
  else go();
  return true;
}
function audit(action, rec){ try{ if(G.TE_RBAC && typeof G.TE_RBAC.audit === "function") G.TE_RBAC.audit(action, { type:"kb", id: rec.id, name: rec.title }); }catch(e){} }

function fieldVal(id){ const el = D.getElementById(id); return el ? String(el.value || "") : ""; }
function collectEditor(id){
  return { id, title: fieldVal("kb-ed-title"), summary: fieldVal("kb-ed-sum"), audience: fieldVal("kb-ed-aud"), cat: fieldVal("kb-ed-cat"),
    tags: fieldVal("kb-ed-tags").split(","), ex: fieldVal("kb-ed-ex").split(/[,\s]+/), tpl: fieldVal("kb-ed-tpl").split(/[,\s]+/),
    sources: fieldVal("kb-ed-src").split("\n"), body: fieldVal("kb-ed-body") };
}
function editorHTML(base, id){
  base = base || {};
  const srcText = arr(base.sources).map(normSrc).filter(Boolean).map(s=> s.u ? s.t + " | " + s.u : s.t).join("\n");
  const sel = (v, opts)=> opts.map(([k, l])=> `<option value="${esc(k)}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("");
  return `<div class="sheet-header"><h3>${id ? "Sửa bài" : "Bài mới"}</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
  <form class="kb-ed" onsubmit="return false">
    <div class="field"><label for="kb-ed-title">Tiêu đề</label><input id="kb-ed-title" maxlength="160" value="${esc(base.title || "")}"></div>
    <div class="field"><label for="kb-ed-sum">Tóm tắt (1–2 câu)</label><textarea id="kb-ed-sum" rows="2" maxlength="400">${esc(base.summary || "")}</textarea></div>
    <div class="kb-ed-row">
      <div class="field"><label for="kb-ed-aud">Đối tượng</label><select id="kb-ed-aud">${sel(base.audience || "nguoi-tap", Object.entries(AUDS))}</select></div>
      <div class="field"><label for="kb-ed-cat">Chuyên mục</label><select id="kb-ed-cat">${sel(base.cat || "bat-dau", CATS.map(c=> [c.id, c.label]))}</select></div>
    </div>
    <div class="field"><label for="kb-ed-tags">Thẻ (cách nhau bằng dấu phẩy)</label><input id="kb-ed-tags" value="${esc(arr(base.tags).join(", "))}"></div>
    <div class="field"><label for="kb-ed-ex">Bài tập liên quan (id, ví dụ: squat, rdl)</label><input id="kb-ed-ex" value="${esc(arr(base.ex).join(", "))}" autocapitalize="off"></div>
    <div class="field"><label for="kb-ed-tpl">Giáo án mẫu (id, ví dụ: tpl-m-fb)</label><input id="kb-ed-tpl" value="${esc(arr(base.tpl).join(", "))}" autocapitalize="off"></div>
    <div class="field"><label for="kb-ed-src">Nguồn — mỗi dòng một nguồn, thêm " | https://…" nếu có liên kết</label><textarea id="kb-ed-src" rows="3">${esc(srcText)}</textarea></div>
    <div class="field"><label for="kb-ed-body">Nội dung (markdown nhẹ)</label><textarea id="kb-ed-body" class="kb-ed-body" rows="14">${esc(base.body || "")}</textarea></div>
    <details class="kb-ed-help"><summary>Cú pháp markdown nhẹ</summary>
      <p><code>## Mục</code> · <code>### Mục con</code> · <code>- gạch đầu dòng</code> · <code>1. đánh số</code> · <code>**đậm**</code> · <code>| bảng | cột |</code><br>
      Hộp: <code>:::ap-dung</code> … <code>:::</code> (cũng có <code>an-toan</code>, <code>meo</code>, <code>luu-y</code>, <code>pt</code>)<br>
      Liên kết: <code>[[ex:squat]]</code> · <code>[[kb:id-bai|chữ]]</code> · <code>[[tpl:tpl-m-fb]]</code></p></details>
    <div id="kb-ed-msg" class="kb-ed-msg" role="status" aria-live="polite"></div>
    <div class="kb-ed-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-ed="preview">Xem trước</button>
      <button type="button" class="btn btn-outline btn-sm" data-ed="draft">Lưu nháp</button>
      ${can("kb.publish") ? `<button type="button" class="btn btn-primary btn-sm" data-ed="publish">${ic("kb_publish")}Xuất bản</button>` : `<button type="button" class="btn btn-primary btn-sm" data-ed="review">Gửi duyệt</button>`}
    </div>
    <div id="kb-ed-preview" class="kb-body kb-ed-preview" hidden></div>
  </form>`;
}
function openEditor(id){
  if(!can("kb.edit")){ say("Bạn chưa có quyền biên tập", "lock"); return false; }
  id = id ? cleanId(id) : null;
  const base = id ? (st().custom[id] || RAW_BY_ID[id] || null) : null;
  if(typeof openSheet !== "function") return false;
  openSheet(editorHTML(base, id));
  const root = D.getElementById("sheet-content");
  if(root && root.addEventListener && !root._kbEd){
    root._kbEd = true;
    root.addEventListener("click", ev=>{
      const b = ev.target && ev.target.closest ? ev.target.closest("[data-ed]") : null; if(!b || !q(".kb-ed", root)) return;
      const mode = b.dataset.ed, o = collectEditor(root._kbId), msg = D.getElementById("kb-ed-msg");
      if(mode === "preview"){ const pv = D.getElementById("kb-ed-preview"); if(pv){ pv.hidden = !pv.hidden; pv.innerHTML = pv.hidden ? "" : mdToHTML(o.body); } return; }
      const r = saveArticle(o, mode);
      if(!r.ok){ if(msg) msg.innerHTML = r.errors.map(x=> `<span>${esc(x)}</span>`).join(""); return; }
      root._kbId = r.id;
      if(typeof closeSheet === "function") closeSheet();
      say(r.status === "published" ? "Đã xuất bản bài viết" : r.status === "review" ? "Đã gửi duyệt" : "Đã lưu nháp", r.status === "published" ? "kb_publish" : "kb_pen");
      if(r.status === "published") openArticle(r.id, { replace: U.view === "article" }); else if(isActive()) nav({ view:"drafts" }, { replace: U.view === "drafts" });
    });
  }
  if(root) root._kbId = id;
  return true;
}

/* Firestore (tuỳ chọn): collection "kb" — rules ở docs/INTEGRATION-admin.md */
function fdb(){ try{ return typeof cloud !== "undefined" && cloud.mode === "firebase" && typeof firebase !== "undefined" && firebase.firestore ? firebase.firestore() : null; }catch(e){ return null; } }
function remoteSave(rec){ const db = fdb(); if(!db) return; try{ const doc = Object.assign({}, rec); db.collection("kb").doc(rec.id).set(doc).catch(e=> warn("remote", e && e.message)); }catch(e){ warn(e); } }
function remoteDelete(id){ const db = fdb(); if(!db) return; try{ db.collection("kb").doc(id).delete().catch(e=> warn("remote", e && e.message)); }catch(e){} }
async function remoteLoad(){
  const db = fdb(); if(!db) return 0;
  try{
    const qs = (can("kb.edit") || can("kb.publish")) ? await db.collection("kb").get() : await db.collection("kb").where("status", "==", "published").get();
    let n = 0; const s = st();
    qs.forEach(d=>{ const v = d.data() || {}; const id = cleanId(d.id); if(!SAFE_ID.test(id)) return; const cur = s.custom[id];
      if(!cur || (Number(v.updatedAt) || 0) > (Number(cur.updatedAt) || 0)){ s.custom[id] = Object.assign({}, v, { id }); n++; } });
    if(n){ persist(); rebuild(); if(isActive()) render(); }
    return n;
  }catch(e){ warn("remote load", e && e.message); return 0; }
}

/* ---------------------------------------------------------------------
   11. ĐIỂM VÀO: menu ☰ · Trang chủ · khu PT · chi tiết bài tập · liên kết sâu
   --------------------------------------------------------------------- */
function menuRowHTML(){
  return `<div class="link-row kb-menu-row" data-kb-menu role="button" tabindex="0" onclick="closeSheet();TEKB.open();"><div class="left">${ic("kb_book")}<div><div class="name">Kho kiến thức</div><div class="sub">${ARTS.length ? ARTS.length + " bài" : "Bài đọc"} · thuật ngữ · hỏi đáp</div></div></div>${ic("chevron_right")}</div>`;
}
function injectMenuString(html){
  if(typeof html !== "string" || html.indexOf("goto('reminders');closeSheet();") < 0 || html.indexOf("data-kb-menu") >= 0) return html;
  const anchors = [`<div class="link-row" onclick="goto('sleep');closeSheet();">`, `<div class="link-row" onclick="goto('reminders');closeSheet();">`];
  for(const a of anchors){ const i = html.indexOf(a); if(i >= 0) return html.slice(0, i) + menuRowHTML() + html.slice(i); }
  return html;
}
function homeCardHTML(){
  const a = todayPick(); if(!a) return "";
  const c = CAT[a.cat] || CATS[0];
  return `<section class="kb-home card" id="kb-home" data-home-zone="bottom" aria-label="Kiến thức hôm nay">
    <div class="kb-home-h">${ic("kb_book")}<b>Kiến thức hôm nay</b><button type="button" class="kb-home-all" onclick="TEKB.open()">Kho kiến thức${ic("chevron_right")}</button></div>
    <button type="button" class="kb-home-a" onclick="TEKB.openArticle('${a.id}')" style="${gradStyle(c)}">
      <span class="kb-home-cat">${ic(c.icon)}${esc(c.label)}</span><b>${esc(a.title)}</b><small>${esc(a.summary)}</small><i>${a.minutes} phút đọc${isRead(a.id) ? " · Đã đọc" : ""}</i>
    </button></section>`;
}
function exploreAvailable(){ try{ return typeof teHomeExplore !== "undefined" && teHomeExplore && typeof teHomeExplore.add === "function"; }catch(e){ return false; } }
function registerExplore(){
  if(!exploreAvailable()) return false;
  if(C.explore) return true;
  const short = s=> s.length > 42 ? s.slice(0, 40).replace(/\s+\S*$/, "") + "…" : s;
  // Vòng tích hợp 3: ô "Kho kiến thức" trong nhóm Kết nối (Tìm PT · Cộng đồng · Sự kiện · Kiến thức · Gian hàng) — mở kho;
  // phụ đề = bài "Kiến thức hôm nay" (chấm 1 khi chưa đọc), bài đó nằm đầu trang kho.
  teHomeExplore.add({ id:"kb", title:"Kho kiến thức", icon:"kb_book", color:"#33D6C9", priority:86,
    sub: ()=>{ const a = todayPick(); return a ? "Hôm nay: " + short(a.title) : ARTS.length ? `${ARTS.length} bài · hỏi đáp` : "Bài đọc · thuật ngữ · hỏi đáp"; },
    badge: ()=>{ const a = todayPick(); return a && !isRead(a.id) ? 1 : ""; },
    onClick: ()=> open() });
  C.explore = true;
  return true;
}
function homeInject(){
  if(registerExplore()) return false;
  const el = D.getElementById("home-content"); if(!el) return false;
  if(String(el.innerHTML || "").indexOf('id="kb-home"') >= 0) return false;
  const html = homeCardHTML(); if(!html) return false;
  const anchor = q(".home-reminders", el);
  if(anchor && anchor.parentNode === el && anchor.insertAdjacentHTML) anchor.insertAdjacentHTML("beforebegin", html); else el.insertAdjacentHTML("beforeend", html);
  return true;
}
function coachCardHTML(){
  const n = ARTS.filter(a=> a.audience === "pt").length;
  return `<button type="button" class="kb-coach" id="kb-coach" onclick="TEKB.open({tab:'pt'})">
    <span class="kb-coach-ic">${ic("kb_badge")}</span>
    <span class="kb-coach-t"><b>Kho kiến thức cho PT</b><small>${n ? n + " bài: c" : "C"}hứng chỉ, sàng lọc, lập trình giáo án, định giá, hợp đồng, giữ chân khách</small></span>${ic("chevron_right")}</button>`;
}
function coachInject(){
  const el = D.getElementById("coach-content"); if(!el) return false;
  if(String(el.innerHTML || "").indexOf('id="kb-coach"') >= 0) return false;
  el.insertAdjacentHTML("beforeend", coachCardHTML());
  return true;
}
function exMoreHTML(exId, compact){
  const L = forExercise(exId, 3); if(!L.length) return "";
  return `<div class="kb-exmore" data-kb-exmore>
    <div class="kb-exmore-h">${ic("kb_book")}<b>Tìm hiểu thêm</b><small>Kho kiến thức</small></div>
    ${L.map(a=> `<button type="button" class="kb-exmore-a" onclick="closeSheet();TEKB.openArticle('${a.id}')"><span>${esc(a.title)}</span><small>${a.minutes} phút</small>${ic("chevron_right")}</button>`).join("")}
  </div>`;
}
function injectExMore(exId){
  const sc = D.getElementById("sheet-content"); if(!sc) return false;
  if(DATA.st !== "ready"){                                    // fkLazy: nạp kho rồi chèn nếu vẫn đúng tấm chi tiết đó
    const first = sc.firstElementChild || null;
    whenReady(ok=>{ try{ const s2 = D.getElementById("sheet-content"); if(ok && s2 && (s2.firstElementChild || null) === first) injectExMore(exId); }catch(e){} });
    return false;
  }
  if(String(sc.innerHTML || "").indexOf("data-kb-exmore") >= 0) return false;
  const h = exMoreHTML(exId); if(!h) return false;
  sc.insertAdjacentHTML("beforeend", h);
  return true;
}
function exIdOfItem(itemUid){
  try{ const s = ST(); const plan = typeof getActivePlan === "function" ? getActivePlan() : null;
    const day = plan && plan.days && plan.days[s.selectedDay]; const it = day && arr(day.items).find(x=> x && x.uid === itemUid);
    return it && it.exerciseId ? it.exerciseId : null; }catch(e){ return null; }
}
function deepLink(){
  try{
    const qp = new URLSearchParams(G.location && G.location.search || "").get("kb");
    const hm = /^#kb\/([a-z0-9-]+)$/.exec(String(G.location && G.location.hash || ""));
    const id = cleanId(qp || (hm && hm[1]) || "");
    if(!id) return false;
    const s = ST(); if(s && !s.onboarded) return false;
    setTimeout(()=> whenReady(ok=>{ try{ if(ok && byId(id)) openArticle(id); else open(); }catch(e){} }), 60);
    return true;
  }catch(e){ return false; }
}
/* Bọc hàm toàn cục (khai báo function ở script khác → gán lại được, không cần eval, an toàn với CSP) */
function install(){
  addIcons();
  /* fkLazy: dữ liệu đã có (thẻ script trong index.html) hoặc chưa có fkLazy → nạp đồng bộ như cũ; ngược lại chờ fkLazy.load('kb') khi cần */
  if(hasData() || !lazyApi()){ loadData(); if(hasData()) DATA.st = "ready"; }
  /* fk-lazy.js nạp trước lúc rảnh (~4 s sau "load") → phát "fk:lazy:kb": chuẩn hoá dữ liệu ngay để ô "Kiến thức hôm nay" có bài */
  try{ if(DATA.st !== "ready" && D.addEventListener) D.addEventListener("fk:lazy:kb", ()=>{ if(DATA.st !== "ready" && hasData()) ensureData(); }); }catch(e){}
  ensureScreen();
  const W = (name, fn)=>{ try{ fn(); C.wrapped.push(name); }catch(e){ warn("wrap " + name, e); } };
  W("goto", ()=>{ if(typeof goto !== "function") return; const old = goto;
    goto = function(screen){
      if(screen === "kb"){ ensureScreen(); if(DATA.st === "error") DATA.st = "idle";   // vào lại sau lỗi tải → thử lại
        try{ const cur = (q(".screen.active") || {}).id || ""; if(cur && cur !== "screen-kb") C.prev = cur.replace("screen-", ""); }catch(e){} }
      const r = old.apply(this, arguments);
      if(screen === "kb") render();
      return r;
    }; });
  W("openSheet", ()=>{ if(typeof openSheet !== "function") return; const old = openSheet;
    openSheet = function(html){ const args = [].slice.call(arguments); try{ args[0] = injectMenuString(html); }catch(e){ warn(e); } return old.apply(this, args); }; });
  W("renderHomeScreen", ()=>{ if(typeof renderHomeScreen !== "function") return; const old = renderHomeScreen;
    renderHomeScreen = function(){ const r = old.apply(this, arguments); try{ homeInject(); }catch(e){ warn("home", e); } return r; }; });
  W("renderCoachScreen", ()=>{ if(typeof renderCoachScreen !== "function") return; const old = renderCoachScreen;
    renderCoachScreen = function(){ const r = old.apply(this, arguments); try{ coachInject(); }catch(e){ warn("coach", e); } return r; }; });
  W("openExerciseDetail", ()=>{ if(typeof openExerciseDetail !== "function") return; const old = openExerciseDetail;
    openExerciseDetail = function(itemUid){ const r = old.apply(this, arguments); try{ const id = exIdOfItem(itemUid); if(id) injectExMore(id); }catch(e){ warn("exdetail", e); } return r; }; });
  W("openLibDetail", ()=>{ if(typeof openLibDetail !== "function") return; const old = openLibDetail;
    openLibDetail = function(key){ const r = old.apply(this, arguments); try{ const k = String(key || ""); if(k.indexOf("fk:") === 0) injectExMore(k.slice(3)); }catch(e){ warn("libdetail", e); } return r; }; });
  W("fkHandleBack", ()=>{ if(typeof fkHandleBack !== "function") return; const old = fkHandleBack;
    fkHandleBack = function(){
      try{ const sb = q("#sheet-backdrop"); const sheetOpen = !!(sb && sb.classList && sb.classList.contains("open")); if(!sheetOpen && isActive()){ backNav(); return true; } }catch(e){}
      return old.apply(this, arguments);
    }; });
  try{ if(G.TE_RBAC && typeof G.TE_RBAC.onChange === "function") G.TE_RBAC.onChange(()=>{ try{ if(isActive()) render(); }catch(e){} }); }catch(e){}
  try{ if(typeof cloud !== "undefined" && cloud && typeof cloud.onAuth === "function") cloud.onAuth(()=>{ remoteLoad(); }); }catch(e){}
  /* vẽ lại màn đang mở */
  try{ registerExplore() || ((q("#screen-home") || {}).classList && q("#screen-home").classList.contains("active") && homeInject()); }catch(e){}
  try{ const cs = q("#screen-coach"); if(cs && cs.classList && cs.classList.contains("active")) coachInject(); }catch(e){}
  remoteLoad();
  deepLink();
  return true;
}

/* ---------------------------------------------------------------------
   12. API
   --------------------------------------------------------------------- */
Object.assign(KB_API(), {
  version: "1.0",
  open, openArticle, openCat, setTab, render, back: backNav, nav,
  search, snippet, recommend, todayPick, related, forExercise, topTags,
  toggleSave, setRead, share, shareUrl, cycleFont,
  parseMd, mdToHTML, inline, fold, tokens,
  saveArticle, setPublished, revert, openEditor, validate, remoteLoad,
  homeCardHTML, homeInject, coachCardHTML, coachInject, exMoreHTML, injectExMore, injectMenuString, registerExplore,
  byId, list(o){ return (o && o.all) ? adminListNow() : ARTS.slice(); },
  adminList,
  /** fkLazy: Promise<boolean> — true khi dữ liệu kb-data-*.js đã sẵn sàng (gọi fkLazy.load('kb') nếu cần) */
  ready: ensureData, whenReady,
  _html: { home: homeHTML, article: id=>{ const a = byId(id); return a ? articleHTML(a) : ""; }, results: resultsHTML, glossary: ()=> glossListHTML(""), faq: faqViewHTML, cat: id=>{ const o = U; U = Object.assign({}, U, { view:"cat", cat:id }); const h = catHTML(); U = o; return h; }, drafts: draftsHTML, editor: (id)=> editorHTML(id ? (st().custom[id] || RAW_BY_ID[id]) : null, id) },
});
/* getter phải khai báo bằng defineProperty (Object.assign sẽ chụp giá trị tại thời điểm gán) */
Object.defineProperties(KB_API(), {
  articles: { get: ()=> ARTS, configurable:true }, glossary: { get: ()=> GLOSS, configurable:true }, faq: { get: ()=> FAQ, configurable:true },
  cats: { get: ()=> CATS, configurable:true }, index: { get: ()=> ensureIndex(), configurable:true }, ui: { get: ()=> U, configurable:true },
  state: { get: ()=> st(), configurable:true }, wrapped: { get: ()=> C.wrapped.slice(), configurable:true },
  dataState: { get: ()=> DATA.st, configurable:true },
});
function KB_API(){ G.TEKB = G.TEKB || {}; G.TE_KB = G.TEKB; return G.TEKB; }
/* admin.js gọi `await KB.adminList()` → khi dữ liệu nạp lười chưa có thì trả Promise (đã nạp: mảng, đồng bộ như cũ) */
function adminList(){
  if(DATA.st !== "ready" && lazyApi()) return ensureData().then(()=> adminListNow());
  return adminListNow();
}
function adminListNow(){
  const s = st(); const out = [];
  RAW.forEach(a=>{ const id = cleanId(a.id), c = s.custom[id]; out.push({ id, title: (c && c.title) || a.title, status: c ? (c.hidden ? "draft" : c.status) : "published", origin: c ? "edited" : "builtin", updatedAt: c ? c.updatedAt : 0 }); });
  Object.keys(s.custom).forEach(id=>{ if(RAW_BY_ID[id]) return; const c = s.custom[id]; out.push({ id, title: c.title, status: c.hidden ? "draft" : c.status, origin:"custom", updatedAt: c.updatedAt || 0 }); });
  return out;
}

try{ G.TEKB.installed = install(); }catch(e){ warn("không cài được", e); }
})(typeof window !== "undefined" ? window : globalThis);

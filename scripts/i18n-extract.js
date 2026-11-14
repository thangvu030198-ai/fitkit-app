#!/usr/bin/env node
/* =========================================================================
   TapEasy — i18n-extract: trích CHUỖI TIẾNG VIỆT HIỂN THỊ từ mã nguồn app (R3 · ux)
   Node thuần, không cần npm install.

     node scripts/i18n-extract.js                  in thống kê theo nhóm màn hình
     node scripts/i18n-extract.js --json OUT.json  ghi toàn bộ chuỗi (đã gộp, kèm file + số lần gặp + nhóm)
     node scripts/i18n-extract.js --todo [N]       in N chuỗi CHƯA có bản dịch, xếp theo độ ưu tiên (mặc định 200)
     node scripts/i18n-extract.js --group home     chỉ nhóm đó (dùng kèm --todo)

   Cách trích (mô phỏng cách DOM tách chữ để khớp với lớp dịch i18n.js):
   - Quét mọi chuỗi '…' "…" `…` trong JS (bỏ chú thích, regex), và chữ + thuộc tính trong HTML.
   - Chuỗi là HTML (có thẻ) → tách thành TỪNG ĐOẠN CHỮ giữa các thẻ (mỗi đoạn = 1 text node) + giá trị
     placeholder / aria-label / title / alt.
   - `${…}` trong template → "{s}" (lớp dịch coi {s} là "bất kỳ", {n} là số). Số viết cứng → giữ nguyên
     (i18n.js tự chuẩn hoá số thành {n} khi tra).
   - Chỉ giữ đoạn có ký tự CÓ DẤU tiếng Việt; chuẩn hoá khoảng trắng + trim (đúng như FK_I18N.norm).
   Giới hạn đã biết: chuỗi ghép bằng dấu + ("Còn " + n + " ngày") cho 2 mảnh rời — lớp dịch có bước dịch theo
   mảnh/tiền tố, phần còn sót xem bằng FK_I18N.missing() trong trình duyệt (scripts/i18n-check.js --runtime).
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

/* ---- nhóm màn hình theo file (để báo độ phủ) ---- */
const GROUPS = [
  ["shell",      /^(index\.html|ui-kit\.js|icons\.js|themes\.js|theme-.*\.js|ui-signature\.js|press-feel\.js|morph-icons\.js|fk-lazy\.js|i18n\.js|feedback\.js|analytics\.js|people-ai\.js|media-config\.js)$/],
  ["core",       /^(app\.js|data\.js)$/],
  ["auth-pt",    /^(pt\.js|coach\.js|ptprofile\.js|cloud\.js|rbac\.js)$/],
  ["training",   /^(training-pro\.js|program-builder\.js|templates\.js|library\.js|video\.js|freevideos\.js|exdb\.js|exdb-vi\.js|achievements\.js|health-safety\.js)$/],
  ["nutrition",  /^(nutrition\.js|nutrition-pro\.js)$/],
  ["pt-pro",     /^(pt-pro\.js|pt-connect\.js|findpt\.js|cloud-pt-directory\.js)$/],
  ["community",  /^(community\.js|cloud-social\.js)$/],
  ["events",     /^(events\.js|events-media\.js|cloud-events\.js)$/],
  ["shop",       /^(shop\.js|shop-data\.js)$/],
  ["admin",      /^(admin\.js|cloud-admin\.js)$/],
  ["kb-ui",      /^kb\.js$/],
  ["content",    /^(kb-data-\d+\.js|meals\.js|meals-extra\.js|exdb-vi-\d+\.js)$/],   // nội dung dài: bài viết, công thức, tên 800 bài
];
const SKIP = /^(sw\.js|firebase-config\.js|i18n-en.*\.js)$/;
function groupOf(file){ for(const [g, re] of GROUPS) if(re.test(file)) return g; return "other"; }

const VI = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/;
const PH = "\u0001";   // vị trí ${…}

function decodeEntities(s){
  return s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&middot;/g, "·").replace(/&rarr;/g, "→").replace(/&harr;/g, "↔")
    .replace(/&#(\d+);/g, (_, d)=> String.fromCodePoint(+d));
}
function norm(s){ return s.replace(/[\s ]+/g, " ").trim(); }

/* ---- bộ quét chuỗi JS ---- */
function scanJS(src, out){
  const n = src.length; let i = 0, prevSig = "";
  const regexOK = ()=> prevSig === "" || /[(,=:\[!&|?{};+\-*%<>~^]$/.test(prevSig) || /(?:^|[^\w$])(?:return|typeof|case|in|of|delete|void|throw|new)$/.test(prevSig);
  function readQuoted(q){
    let s = ""; i++;
    while(i < n){
      const c = src[i];
      if(c === "\\"){
        const d = src[i + 1];
        if(d === "n") s += "\n"; else if(d === "t") s += " ";
        else if(d === "u"){ const m = /^u\{([0-9a-fA-F]+)\}|^u([0-9a-fA-F]{4})/.exec(src.slice(i + 1, i + 10)); if(m){ s += String.fromCodePoint(parseInt(m[1] || m[2], 16)); i += m[0].length + 1; continue; } }
        else if(d === "\n"){ /* nối dòng */ }
        else s += d;
        i += 2; continue;
      }
      if(c === q){ i++; return s; }
      if(c === "\n" && q !== "`") return s;   // chuỗi hỏng → bỏ
      s += c; i++;
    }
    return s;
  }
  function readTemplate(){
    let s = ""; i++;
    while(i < n){
      const c = src[i];
      if(c === "\\"){ const d = src[i + 1]; s += d === "n" ? "\n" : (d === "t" ? " " : d); i += 2; continue; }
      if(c === "`"){ i++; return s; }
      if(c === "$" && src[i + 1] === "{"){
        i += 2; let depth = 1; const start = i;
        while(i < n && depth > 0){
          const d = src[i];
          if(d === "{") depth++; else if(d === "}"){ depth--; if(!depth) break; }
          else if(d === "'" || d === '"'){ const lit = readQuoted(d); out(lit); continue; }
          else if(d === "`"){ const lit = readTemplate(); out(lit); continue; }
          else if(d === "/" && src[i + 1] === "*"){ const e = src.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; continue; }
          i++;
        }
        i++; s += PH; continue;
      }
      s += c; i++;
    }
    return s;
  }
  while(i < n){
    const c = src[i];
    if(c === "/" && src[i + 1] === "/"){ const e = src.indexOf("\n", i); i = e < 0 ? n : e; continue; }
    if(c === "/" && src[i + 1] === "*"){ const e = src.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; continue; }
    if(c === "'" || c === '"'){ out(readQuoted(c)); prevSig = '"'; continue; }
    if(c === "`"){ out(readTemplate()); prevSig = '"'; continue; }
    if(c === "/" && regexOK()){
      let j = i + 1, cls = false, ok = false;
      while(j < n && src[j] !== "\n"){
        const d = src[j];
        if(d === "\\"){ j += 2; continue; }
        if(d === "[") cls = true; else if(d === "]") cls = false;
        else if(d === "/" && !cls){ ok = true; break; }
        j++;
      }
      if(ok){ i = j + 1; prevSig = "x"; continue; }
    }
    if(!/\s/.test(c)) prevSig = (prevSig + c).slice(-8);
    i++;
  }
}

/* ---- một chuỗi (có thể là HTML) → các đoạn chữ hiển thị ---- */
const ATTRS = /\b(placeholder|aria-label|title|alt|data-tip|data-label)\s*=\s*("([^"]*)"|'([^']*)')/gi;
function fragmentsOf(lit){
  const res = [];
  if(!VI.test(lit)) return res;
  if(/<[a-zA-Z\/!][^>]*>/.test(lit) || /<\/?[a-zA-Z]/.test(lit)){
    let m; ATTRS.lastIndex = 0;
    while((m = ATTRS.exec(lit))) res.push(m[3] != null ? m[3] : m[4]);
    const body = lit.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "\u0002").replace(/<!--[\s\S]*?-->/g, "\u0002")
      .replace(/<[a-zA-Z\/!](?:"[^"]*"|'[^']*'|[^>"'])*>/g, "\u0002").replace(/<[a-zA-Z\/][^<]*$/, "\u0002").replace(/^[^<>]*>/, m0=> /=/.test(m0) ? "\u0002" : m0);
    for(const part of body.split("\u0002")) res.push(part);
  } else res.push(lit);
  return res.map(s=> norm(decodeEntities(s))).map(s=>{
    // ${…} → {s}; bỏ {s} đứng trơ trọi ở đầu/cuối (i18n.js dịch theo tiền tố/hậu tố)
    let t = s.split(PH).join("{s}");
    t = t.replace(/^(?:\{s\}\s*)+/, "").replace(/(?:\s*\{s\})+$/, "");
    return norm(t);
  }).filter(s=> s && VI.test(s) && s.length <= 400 && !/^[\w.#\[\]=\-:>\s,"'*()]+$/.test(s) && !/[{};]\s*$/.test(s.replace(/\{s\}/g, "")) );
}

function scanHTML(src, add){
  // script nội tuyến
  src = src.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, js)=>{ scanJS(js, lit=> fragmentsOf(lit).forEach(add)); return ""; });
  fragmentsOf(src.replace(/<head>[\s\S]*?<\/head>/i, m=> (m.match(/<title>[\s\S]*?<\/title>/i) || [""])[0])).forEach(add);
}

function extract(){
  const files = fs.readdirSync(ROOT).filter(f=> (/\.js$/.test(f) || f === "index.html") && !SKIP.test(f)).sort();
  const map = new Map();   // chuỗi → { n, files:Set, groups:Set }
  for(const f of files){
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    const g = groupOf(f);
    const add = s=>{
      let e = map.get(s); if(!e){ e = { n:0, files:new Set(), groups:new Set() }; map.set(s, e); }
      e.n++; e.files.add(f); e.groups.add(g);
    };
    if(/\.html$/.test(f)) scanHTML(src, add);
    else scanJS(src, lit=> fragmentsOf(lit).forEach(add));
  }
  return map;
}

/* ---- nạp từ điển + bộ dịch thật của i18n.js (chạy trong vm, không cần DOM) ---- */
function loadI18n(){
  const vm = require("vm");
  const win = { localStorage:{ getItem(){ return null; }, setItem(){} }, navigator:{ language:"vi-VN" } };
  win.window = win;
  const ctx = vm.createContext(win);
  const run = f=> vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename:f });
  run("i18n.js");
  fs.readdirSync(ROOT).filter(f=> /^i18n-en.*\.js$/.test(f)).sort().forEach(run);
  return win.FK_I18N;
}

const PRIO = { shell:0, core:1, "auth-pt":2, training:3, nutrition:4, "pt-pro":5, community:6, events:7, shop:8, admin:9, "kb-ui":10, other:11, content:20 };
function report(map, I, lang){
  const rows = [];
  for(const [s, e] of map){
    const gs = [...e.groups].sort((a, b)=> PRIO[a] - PRIO[b]);
    const out = I ? I.translate(s, lang) : null;
    rows.push({ s, n:e.n, group:gs[0], groups:gs, files:[...e.files], en: out, ok: out != null && out !== s });
  }
  rows.sort((a, b)=> (PRIO[a.group] - PRIO[b.group]) || (b.n - a.n) || (a.s.length - b.s.length));
  return rows;
}
function summary(rows){
  const by = {};
  for(const r of rows){ const b = by[r.group] = by[r.group] || { total:0, ok:0 }; b.total++; if(r.ok) b.ok++; }
  return by;
}

if(require.main === module){
  const args = process.argv.slice(2);
  const arg = k=>{ const i = args.indexOf(k); return i < 0 ? null : (args[i + 1] && !/^--/.test(args[i + 1]) ? args[i + 1] : true); };
  const map = extract();
  let I = null; try{ I = loadI18n(); }catch(e){ console.error("(chưa nạp được i18n.js/từ điển: " + e.message + ")"); }
  const rows = report(map, I, "en");
  const by = summary(rows);
  if(arg("--json")){ fs.writeFileSync(arg("--json"), JSON.stringify(rows, null, 1)); console.log("Đã ghi " + arg("--json")); }
  if(arg("--todo")){
    const N = +arg("--todo") || 200, g = arg("--group");
    rows.filter(r=> !r.ok && (!g || g === true || r.group === g)).slice(0, N).forEach(r=> console.log(JSON.stringify(r.s) + "\t" + r.group + "×" + r.n));
  } else {
    console.log("Nhóm".padEnd(12) + "chuỗi".padStart(7) + "đã dịch".padStart(9) + "   %");
    let T = 0, K = 0, TU = 0, KU = 0;
    for(const g of Object.keys(by).sort((a, b)=> PRIO[a] - PRIO[b])){
      const b = by[g]; T += b.total; K += b.ok; if(g !== "content"){ TU += b.total; KU += b.ok; }
      console.log(g.padEnd(12) + String(b.total).padStart(7) + String(b.ok).padStart(9) + ("   " + (100 * b.ok / b.total).toFixed(1)));
    }
    console.log("GIAO DIỆN".padEnd(12) + String(TU).padStart(7) + String(KU).padStart(9) + "   " + (100 * KU / Math.max(1, TU)).toFixed(1) + "   (không tính nhóm content)");
    console.log("TẤT CẢ".padEnd(12) + String(T).padStart(7) + String(K).padStart(9) + "   " + (100 * K / Math.max(1, T)).toFixed(1));
    if(I) console.log("Mục từ điển: " + I.size("en"));
  }
}
module.exports = { extract, report, summary, loadI18n, groupOf, fragmentsOf, scanJS };

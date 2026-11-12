#!/usr/bin/env node
/* TapEasy intro — kiểm logic compose.js KHÔNG cần Chromium (máy/sandbox không có trình duyệt).
   DOM giả tối thiểu (phân tích HTML đơn giản, bộ chọn .lớp / thẻ / con cháu) → dựng composer, gọi render(t) ở mọi khung
   (bước --step giây) cho cả 2 khổ, bắt lỗi JS, kiểm tính thuần (render(t) hai lần ra cùng kết quả), kiểm phụ đề (typo):
   không còn dấu "—", không dấu "·" đầu cụm, 2 từ cuối dính nhau. KHÔNG đo bố cục (không có layout) — việc đó do qa_fit.py.
     node scripts/intro-video/smoke_node.js [--step 0.1] [--from 0] [--to 999]
*/
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const HERE = __dirname, BUILD = path.join(HERE, "build");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : d; };

/* ---------------- DOM giả ---------------- */
const VOID = new Set(["img", "br", "input", "meta", "link", "hr"]);
class Style {
  constructor(){ Object.defineProperty(this, "_p", { value: {}, enumerable: false, writable: true }); }
  setProperty(k, v){ this._p[k] = v; } removeProperty(k){ delete this._p[k]; } getPropertyValue(k){ return this._p[k] || ""; }
  get cssText(){ return Object.keys(this).map(k => k + ":" + this[k]).join(";"); }
  set cssText(v){ for(const k of Object.keys(this)) delete this[k]; String(v || "").split(";").forEach(d => { const i = d.indexOf(":"); if(i > 0){ const k = d.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()); this[k] = d.slice(i + 1).trim(); } }); }
}
class CL { constructor(e){ this.e = e; } get _s(){ return new Set((this.e.className || "").split(/\s+/).filter(Boolean)); }
  add(...c){ const s = this._s; c.forEach(x => s.add(x)); this.e.className = [...s].join(" "); }
  remove(...c){ const s = this._s; c.forEach(x => s.delete(x)); this.e.className = [...s].join(" "); }
  contains(c){ return this._s.has(c); } toggle(c, f){ const on = f === undefined ? !this.contains(c) : !!f; on ? this.add(c) : this.remove(c); return on; } }
class Node {
  constructor(tag){ this.tagName = (tag || "#text").toUpperCase(); this.localName = (tag || "").toLowerCase(); this.childNodes = []; this.parentNode = null; this.attrs = {}; this.style = new Style(); this.className = ""; this._text = ""; this.classList = new CL(this); }
  get nodeType(){ return this.tagName === "#TEXT" ? 3 : 1; }
  get children(){ return this.childNodes.filter(n => n.nodeType === 1); }
  get firstChild(){ return this.childNodes[0] || null; }
  get childElementCount(){ return this.children.length; }
  get parentElement(){ return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  get isConnected(){ let n = this; while(n.parentNode) n = n.parentNode; return n === DOC.body || n === DOC; }
  appendChild(c){ if(c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.childNodes.push(c); return c; }
  prepend(c){ if(c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.childNodes.unshift(c); return c; }
  removeChild(c){ const i = this.childNodes.indexOf(c); if(i < 0) throw new Error("removeChild: không phải con"); this.childNodes.splice(i, 1); c.parentNode = null; return c; }
  remove(){ if(this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v){ v = String(v); if(k === "class") this.className = v; else if(k === "style") this.style.cssText = v; else this.attrs[k] = v; }
  getAttribute(k){ return k === "class" ? this.className : (k in this.attrs ? this.attrs[k] : (k === "src" && this._src != null ? this._src : null)); }
  get src(){ return this._src || ""; } set src(v){ this._src = String(v); this.attrs.src = this._src; this.complete = true; this.naturalWidth = 1170; this.naturalHeight = 2532; }
  decode(){ return Promise.resolve(); }
  get textContent(){ return this.nodeType === 3 ? this._text : this.childNodes.map(c => c.textContent).join(""); }
  set textContent(v){ if(this.nodeType === 3){ this._text = String(v); return; } this.childNodes.forEach(c => c.parentNode = null); this.childNodes = []; if(v !== "" && v != null){ const t = new Node(); t._text = String(v); this.appendChild(t); } }
  set innerHTML(h){ this.childNodes.forEach(c => c.parentNode = null); this.childNodes = []; parseInto(this, String(h)); }
  get innerHTML(){ return ""; }
  cloneNode(deep){ const n = new Node(this.localName || null); n._text = this._text; n.className = this.className; Object.assign(n.attrs, this.attrs); n.style.cssText = this.style.cssText; if(deep) this.childNodes.forEach(c => n.appendChild(c.cloneNode(true))); return n; }
  getBoundingClientRect(){ return { left:0, top:0, width:0, height:0, right:0, bottom:0, x:0, y:0 }; }
  get offsetTop(){ return 0; } get offsetHeight(){ return 0; } get offsetWidth(){ return 0; } get scrollWidth(){ return 0; }
  _all(){ const out = []; const walk = n => n.childNodes.forEach(c => { if(c.nodeType === 1){ out.push(c); walk(c); } }); walk(this); return out; }
  querySelectorAll(sel){ return sel.split(",").flatMap(s => { const parts = s.trim().split(/\s+/); return this._all().filter(e => matchChain(e, parts, this)); }); }
  querySelector(sel){ return this.querySelectorAll(sel)[0] || null; }
  addEventListener(){} removeEventListener(){}
}
function matchOne(e, c){
  const m = /^([a-zA-Z][\w-]*)?((?:\.[\w-]+)*)$/.exec(c); if(!m) throw new Error("bộ chọn chưa hỗ trợ: " + c);
  if(m[1] && e.localName !== m[1].toLowerCase()) return false;
  const cls = m[2].split(".").filter(Boolean), have = new Set(e.className.split(/\s+/));
  return cls.every(x => have.has(x));
}
function matchChain(e, parts, root){
  if(!matchOne(e, parts[parts.length - 1])) return false;
  let i = parts.length - 2, n = e.parentNode;
  while(i >= 0 && n && n !== root.parentNode){ if(n.nodeType === 1 && matchOne(n, parts[i])) i--; n = n.parentNode; }
  return i < 0;
}
function parseInto(parent, h){
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  const stack = [parent]; let m;
  while((m = re.exec(h))){
    const top = stack[stack.length - 1];
    if(m[1]){ for(let i = stack.length - 1; i > 0; i--) if(stack[i].localName === m[1].toLowerCase()){ stack.length = i; break; } continue; }
    if(m[2]){
      const e = new Node(m[2]);
      (m[3] || "").replace(/([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g, (_, k, __, a, b, c) => { e.setAttribute(k, a != null ? a : b != null ? b : c != null ? c : ""); });
      top.appendChild(e);
      if(!m[4] && !VOID.has(m[2].toLowerCase())) stack.push(e);
      continue;
    }
    if(m[5]){ const t = new Node(); t._text = m[5].replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'); top.appendChild(t); }
  }
}
const DOC = new Node("#document"); DOC.tagName = "#DOCUMENT";
DOC.body = new Node("body"); DOC.appendChild(DOC.body);
Object.assign(DOC, { createElement: t => new Node(t), createTextNode: s => { const t = new Node(); t._text = String(s); return t; },
  getElementById: id => DOC._all().find(e => e.attrs.id === id) || null, fonts: { ready: Promise.resolve() } });

/* ---------------- chạy ---------------- */
const read = f => fs.readFileSync(f, "utf8");
const TL = JSON.parse(read(path.join(BUILD, "timeline.resolved.json")));
const MANP = path.join(BUILD, "manifest.json");
const MAN = fs.existsSync(MANP) ? JSON.parse(read(MANP)) : null;
const src = read(path.join(HERE, "compose.js"));
let fails = 0;
const say = (ok, msg) => { if(!ok) fails++; console.log((ok ? "ok    " : "LỖI   ") + msg); };

async function run(w, h){
  const stage = new Node("div"); stage.attrs.id = "stage"; DOC.body.appendChild(stage);
  const win = { document: DOC, __NO_AUTO: true, __TIMELINE__: TL, __MANIFEST__: MAN, location: { search: "" }, URLSearchParams, performance, console, setTimeout, Promise, Math, JSON, Number, String, Array, Object, Set, Map, parseFloat, parseInt, isNaN, Date };
  win.window = win; vm.createContext(win);
  vm.runInContext(src, win, { filename: "compose.js" });
  const comp = win.__makeComposer({ stage, w, h, fps: 30 });
  await comp.ready;
  const step = arg("--step", 0.1), t0 = arg("--from", 0), t1 = Math.min(arg("--to", 1e9), TL.duration - 1e-3);
  let n = 0, err = null;
  for(let t = t0; t <= t1; t += step){ try{ comp.render(+t.toFixed(4)); n++; }catch(e){ err = `t=${t.toFixed(2)}: ${e.stack.split("\n").slice(0, 3).join(" | ")}`; break; } }
  say(!err, `${w}×${h}: render(t) ${n} khung (${t0}–${t1.toFixed(1)} s, bước ${step})${err ? " → " + err : ""}`);
  // tính thuần: cùng t → cùng DOM
  const hidden = e => { for(let x = e; x && x !== stage; x = x.parentNode){ if(x.style.display === "none" || /^0(\.0+)?$/.test(String(x.style.opacity))) return true; } return false; };
  const snap = () => JSON.stringify(stage._all().filter(e => !hidden(e)).map(e => [e.className, e.style.cssText, e.childNodes.length === 1 && e.childNodes[0].nodeType === 3 ? e.textContent : ""]));   // chỉ phần đang hiện
  const soon = TL.chapters.find(c => c.kind === "soon");
  for(const t of [soon ? soon.t0 + 3.3 : 10, soon ? soon.t0 + 26.4 : 20, 150.1]){
    comp.render(t); const a = snap(); comp.render(t - 7); comp.render(t); const b = snap();
    say(a === b, `${w}×${h}: render(${t.toFixed(2)}) thuần (vẽ lại sau khi nhảy thời gian → giống hệt)`);
  }
  stage.remove();
}
(async () => {
  // phụ đề
  const ctx = { console }; vm.createContext(ctx);
  const a = src.indexOf("const NB"), b = src.indexOf("const escT");
  vm.runInContext(src.slice(a, b).replace("const NB", "var NB"), ctx);
  const clamp = (x, a0, b0) => Math.max(a0, Math.min(b0, x));
  let capBad = 0;
  TL.chapters.forEach(c => (c.captions || []).forEach(([t, s]) => {
    const o = ctx.typo(s), toks = o.split(" ");
    const issues = [];
    if(/—/.test(s)) issues.push("còn gạch dài —");
    toks.forEach((k, i) => { if(i && /^[·—–:,;.]/.test(k)) issues.push("dấu mở cụm: " + k); });
    if(toks.length > 1 && !/ /.test(toks[toks.length - 1])) issues.push("từ cuối có thể mồ côi");
    if(issues.length){ capBad++; console.log(`LỖI   phụ đề ${c.id}: “${s}” → ${issues.join(", ")}`); }
  }));
  say(!capBad, `phụ đề: ${TL.chapters.reduce((n, c) => n + (c.captions || []).length, 0)} câu — không gạch dài, không dấu mở dòng, 2 từ cuối luôn dính`);
  const intro = TL.chapters[0].captions.map(x => x[1]);
  say(intro.includes("Tiếng Việt · Miễn phí") && intro.some(x => x.replace(/~/g, " ") === "Giáo án · Dinh dưỡng · Kết nối PT trong 1 App"), "phụ đề mở đầu đúng chữ góp ý");
  const outro = TL.chapters[TL.chapters.length - 1];
  say(TL.duration - outro.cta_at - 1.3 >= 6, `QR cuối phim đứng yên ${(TL.duration - outro.cta_at - 1.3).toFixed(1)} s (≥ 6 s)`);
  const soon = TL.chapters.find(c => c.kind === "soon");
  say(soon && soon.t1 - soon.t0 >= 30 && soon.t1 - soon.t0 <= 45 && TL.chapters.indexOf(soon) === TL.chapters.length - 2, `chương "Sắp ra mắt" ${soon ? (soon.t1 - soon.t0).toFixed(1) : 0} s, ngay trước phần kết`);
  const fp = TL.chapters.flatMap(c => c.shots).find(s => s.id === "fpprofile");
  say(fp && fp.seq && fp.seq.t1 - fp.seq.t0 >= 5, `hồ sơ PT: chuỗi khung số đếm ${fp && fp.seq ? (fp.seq.t1 - fp.seq.t0).toFixed(1) : 0} s (≥ 5 s)`);
  say(!/github|https?:\/\//i.test(read(path.join(HERE, "timeline.json"))), "timeline không có URL/GitHub");
  await run(1080, 1920);
  await run(1920, 1080);
  console.log(fails ? `\n${fails} lỗi` : "\nTẤT CẢ ĐẠT");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

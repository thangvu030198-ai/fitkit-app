/* DOM giả tối thiểu cho smoke_node.js (chép từ scripts/intro-video/smoke_node.js, thêm bộ chọn [thuộc-tính]) — không cần trình duyệt */
"use strict";
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
  const am = /^\[([\w-]+)\]$/.exec(c); if(am) return am[1] in e.attrs;
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

module.exports = { Node, DOC };

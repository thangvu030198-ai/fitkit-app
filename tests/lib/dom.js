/* =========================================================================
   FIT KIT tests — DOM shim tối thiểu (không phụ thuộc thư viện ngoài)
   Mục tiêu: đủ để nạp toàn bộ script của index.html trong vm và gọi được các
   hàm render mà không ném lỗi; KHÔNG phân tích HTML. innerHTML được lưu dạng
   chuỗi để test bảo mật đọc lại (vd #toast, #sheet-content).
   - $("#id") / getElementById → phần tử trong registry (tự tạo nếu chưa có)
   - "#id.cls" → trả null nếu phần tử chưa có class đó (để `$("#screen-x.active")` đúng nghĩa)
   - Selector khác → phần tử rời (detached) để code không vỡ; querySelectorAll → []
   ========================================================================= */
"use strict";

class ClassList {
  constructor(){ this._s = new Set(); }
  add(...c){ c.forEach(x=> x && this._s.add(String(x))); }
  remove(...c){ c.forEach(x=> this._s.delete(String(x))); }
  contains(c){ return this._s.has(String(c)); }
  toggle(c, force){ const on = force===undefined ? !this._s.has(c) : !!force; if(on) this._s.add(c); else this._s.delete(c); return on; }
  replace(a, b){ if(this._s.delete(a)) this._s.add(b); }
  get length(){ return this._s.size; }
  get value(){ return [...this._s].join(" "); }
  toString(){ return this.value; }
  forEach(fn){ [...this._s].forEach(fn); }
}

function makeDom(){
  const registry = new Map();      // id → element
  const htmlLog = [];              // mọi lần gán innerHTML (để test bảo mật)

  class Element {
    constructor(tag){
      this.tagName = String(tag||"div").toUpperCase(); this.nodeName = this.tagName; this.nodeType = 1;
      this.children = []; this.childNodes = this.children; this.parentElement = null; this.parentNode = null;
      this.classList = new ClassList(); this.dataset = {}; this.attributes = {};
      this.style = { setProperty(){}, removeProperty(){}, getPropertyValue(){ return ""; } };
      this._html = ""; this._text = ""; this._id = "";
      this.value = ""; this.hidden = false; this.disabled = false; this.checked = false; this.files = [];
      this.scrollTop = 0; this.scrollLeft = 0; this.scrollHeight = 0; this.clientHeight = 0; this.clientWidth = 0;
      this.offsetWidth = 0; this.offsetHeight = 0; this.offsetTop = 0; this.offsetLeft = 0;
      this._listeners = {}; this.src = ""; this.href = ""; this.currentTime = 0; this.duration = 0; this.paused = true;
      this.videoWidth = 0; this.videoHeight = 0; this.width = 0; this.height = 0; this.type = ""; this.name = "";
    }
    get id(){ return this._id; }
    set id(v){ this._id = String(v); if(v) registry.set(String(v), this); }
    get className(){ return this.classList.value; }
    set className(v){ this.classList = new ClassList(); String(v||"").split(/\s+/).forEach(c=> c && this.classList.add(c)); }
    get innerHTML(){ return this._html; }
    set innerHTML(v){ this._html = String(v); this.children.length = 0; htmlLog.push({ id: this._id, html: this._html }); }
    get outerHTML(){ return `<${this.tagName.toLowerCase()}>${this._html}</${this.tagName.toLowerCase()}>`; }
    get textContent(){ return this._text || this._html.replace(/<[^>]*>/g, ""); }
    set textContent(v){ this._text = String(v==null ? "" : v); this._html = this._text.replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
    get innerText(){ return this.textContent; }
    set innerText(v){ this.textContent = v; }
    insertAdjacentHTML(pos, html){ this._html += String(html); htmlLog.push({ id: this._id, html: String(html) }); }
    insertAdjacentElement(pos, el){ return this.appendChild(el); }
    querySelector(sel){ return doc._query(sel, this); }
    querySelectorAll(sel){ return doc._queryAll(sel, this); }
    getElementsByTagName(){ return []; }
    getElementsByClassName(){ return []; }
    closest(){ return new Element("div"); }
    matches(){ return false; }
    contains(){ return false; }
    addEventListener(t, fn){ (this._listeners[t] = this._listeners[t] || []).push(fn); }
    removeEventListener(t, fn){ const a = this._listeners[t]; if(a){ const i = a.indexOf(fn); if(i>=0) a.splice(i,1); } }
    dispatchEvent(ev){ (this._listeners[ev && ev.type] || []).forEach(fn=>{ try{ fn.call(this, ev); }catch(e){} }); if(this["on"+(ev&&ev.type)]) try{ this["on"+ev.type](ev); }catch(e){} return true; }
    click(){ this.dispatchEvent({ type:"click", target:this, currentTarget:this, preventDefault(){}, stopPropagation(){} }); }
    appendChild(c){ if(c && typeof c === "object"){ this.children.push(c); c.parentElement = this; c.parentNode = this; } return c; }
    append(...cs){ cs.forEach(c=> typeof c === "object" ? this.appendChild(c) : (this._html += String(c))); }
    prepend(...cs){ cs.forEach(c=> typeof c === "object" && this.children.unshift(c)); }
    insertBefore(c){ return this.appendChild(c); }
    removeChild(c){ const i = this.children.indexOf(c); if(i>=0) this.children.splice(i,1); return c; }
    replaceChild(n, o){ this.removeChild(o); return this.appendChild(n); }
    remove(){ if(this.parentElement) this.parentElement.removeChild(this); }
    replaceWith(n){ if(this.parentElement){ this.parentElement.removeChild(this); this.parentElement.appendChild(n); } }
    cloneNode(){ const e = new Element(this.tagName); e._html = this._html; return e; }
    setAttribute(k, v){ this.attributes[k] = String(v); if(k==="id") this.id = v; if(k==="class") this.className = v; if(k.startsWith("data-")) this.dataset[k.slice(5).replace(/-([a-z])/g,(m,c)=>c.toUpperCase())] = String(v); }
    getAttribute(k){ return k in this.attributes ? this.attributes[k] : null; }
    removeAttribute(k){ delete this.attributes[k]; }
    hasAttribute(k){ return k in this.attributes; }
    toggleAttribute(k, f){ const on = f===undefined ? !(k in this.attributes) : !!f; if(on) this.attributes[k] = ""; else delete this.attributes[k]; return on; }
    getBoundingClientRect(){ return { top:0, left:0, right:0, bottom:0, width:0, height:0, x:0, y:0 }; }
    getContext(){ return null; }
    scrollTo(){} scrollBy(){} scrollIntoView(){} focus(){} blur(){} select(){} setSelectionRange(){}
    play(){ return Promise.resolve(); } pause(){} load(){} requestFullscreen(){ return Promise.resolve(); }
    animate(){ return { finished: Promise.resolve(), cancel(){}, finish(){}, onfinish:null }; }
    attachShadow(){ return new Element("div"); }
    get firstElementChild(){ return this.children[0] || null; }
    get lastElementChild(){ return this.children[this.children.length-1] || null; }
    get firstChild(){ return this.children[0] || null; }
    get lastChild(){ return this.children[this.children.length-1] || null; }
    get nextElementSibling(){ return null; }
    get previousElementSibling(){ return null; }
    get isConnected(){ return true; }
    get options(){ return []; }
    get selectedIndex(){ return 0; }
  }

  function byId(id){
    if(!registry.has(id)){ const e = new Element("div"); e.id = id; }
    return registry.get(id);
  }

  const doc = {
    Element, htmlLog, registry,
    nodeType: 9, readyState: "complete", visibilityState: "visible", hidden: false, title: "FIT KIT", cookie: "",
    fonts: { ready: Promise.resolve(), load(){ return Promise.resolve(); } },
    _listeners: {},
    createElement(t){ return new Element(t); },
    createElementNS(ns, t){ return new Element(t); },
    createTextNode(t){ const e = new Element("#text"); e.textContent = t; e.nodeType = 3; return e; },
    createDocumentFragment(){ return new Element("fragment"); },
    getElementById(id){ return byId(id); },
    getElementsByTagName(){ return []; },
    getElementsByClassName(){ return []; },
    addEventListener(t, fn){ (this._listeners[t] = this._listeners[t] || []).push(fn); },
    removeEventListener(){},
    dispatchEvent(){ return true; },
    execCommand(){ return true; },
    _query(sel, root){
      sel = String(sel).trim();
      // lấy phần cuối của selector con cháu (vd "#sheet-content [data-kg]" → "[data-kg]")
      const parts = sel.split(/\s+|\s*>\s*/).filter(Boolean);
      const last = parts[parts.length-1];
      const m = last.match(/^#([\w-]+)((?:\.[\w-]+)*)$/);
      if(m){
        const el = byId(m[1]);
        const classes = m[2] ? m[2].split(".").filter(Boolean) : [];
        return classes.every(c=> el.classList.contains(c)) ? el : null;
      }
      if(/^(body)$/.test(last)) return doc.body;
      return new Element("div");
    },
    _queryAll(){ return []; },
    querySelector(sel){ return this._query(sel, this); },
    querySelectorAll(sel){ return this._queryAll(sel, this); },
  };
  doc.documentElement = new Element("html");
  doc.head = new Element("head");
  doc.body = new Element("body");
  doc.activeElement = doc.body;
  return doc;
}

module.exports = { makeDom, ClassList };

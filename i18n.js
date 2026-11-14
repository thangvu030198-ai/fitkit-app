/* =========================================================================
   TapEasy — FK_I18N: lớp DỊCH DOM (R3 · ux · docs/qa/R3-ux.md §i18n)
   Mã app viết chuỗi tiếng Việt cứng trong ~60 file → không sửa từng file: lớp này dịch CHỮ ĐÃ VẼ RA.

   API (window.FK_I18N):
     lang                      mã ngôn ngữ đang dùng ("vi" mặc định)
     setLang(code) → Promise   đổi ngôn ngữ (không tải lại trang); lưu localStorage "fk_lang"
     t(vi[, lang]) → string    dịch 1 chuỗi tiếng Việt (không có bản dịch → trả nguyên chuỗi)
     translate(vi, lang)       như t() nhưng trả null khi KHÔNG có bản dịch (cho công cụ đo độ phủ)
     onChange(cb) → huỷ()      gọi cb(lang) mỗi lần đổi ngôn ngữ
     add(lang, {vi: dịch,…})   nạp từ điển (file i18n-<lang>*.js gọi)
     register(code, {name, locale, files})   thêm ngôn ngữ mới (kiến trúc mở: chỉ cần file từ điển)
     protect(selector)         vùng KHÔNG dịch (nội dung người dùng nhập) — ngoài [data-no-i18n]
     fmtNum(n[, opts]) · fmtDate(d[, opts])   định dạng theo ngôn ngữ (Intl)
     missing() → [[chuỗi, số lần]]   chuỗi tiếng Việt đã hiển thị mà chưa có bản dịch (để bổ sung từ điển)
     openPicker()              mở hộp chọn ngôn ngữ

   Từ điển: khoá = CHUỖI TIẾNG VIỆT GỐC (trim + gộp khoảng trắng). Biến số trong khoá:
     {n} = một số (12 · 1.234 · 2,5)      "Tuần {n}" → "Week {n}"
     {s} = đoạn bất kỳ (được dịch tiếp)    "Buổi {s}" → "{s} session"
   Trong bản dịch: {n}/{s} lấy lần lượt theo thứ tự xuất hiện ở khoá; {1} {2}… lấy theo vị trí (đổi trật tự);
   [[một|nhiều]] chọn theo số đầu tiên (1 → "một").  Tra theo thứ tự: nguyên văn → không phân biệt hoa/thường
   (giữ kiểu HOA) → chuẩn hoá số thành {n} → mẫu {s} → bỏ ký hiệu đầu/cuối → tách theo " · " ": " " — "…
   → "Tên Việt (English)" lấy phần trong ngoặc.

   DOM: khi lang ≠ "vi" dịch toàn trang 1 lần rồi MutationObserver dịch nút mới/đổi chữ, gộp theo
   requestAnimationFrame — O(số nút thay đổi). Bản gốc lưu trong WeakMap ⇒ đổi lại tiếng Việt tức thì.
   KHÔNG dịch: [data-no-i18n], vùng contenteditable, <textarea>/<script>/<style>/<code>, giá trị ô nhập,
   vùng đã protect(). Dịch thuộc tính placeholder / aria-label / title / alt và document.title.
   ========================================================================= */
(function(){
  "use strict";
  var W = typeof window !== "undefined" ? window : globalThis;
  if(W.FK_I18N && W.FK_I18N.__v) return;
  var D = W.document || null;
  var LS_KEY = "fk_lang", LS_HINT = "fk_lang_hint";
  var ATTRS = ["placeholder", "aria-label", "title", "alt"];
  var SKIP_TAGS = { SCRIPT:1, STYLE:1, TEXTAREA:1, CODE:1, PRE:1, NOSCRIPT:1, TEMPLATE:1 };
  var NUM_RE = /\d+(?:[.,]\d+)*/g;
  var VI_RE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/i;
  var LETTER_RE = /[A-Za-zÀ-ɏḀ-ỿ]/;
  var SPLIT_RE = /( · | • | — | – | \| | \/ | → |: |\n)/;

  var LANGS = {
    vi: { name: "Tiếng Việt", locale: "vi-VN", files: [] },
    en: { name: "English", locale: "en-US", files: ["i18n-en.js", "i18n-en-2.js", "i18n-en-3.js", "i18n-en-4.js", "i18n-en-5.js", "i18n-en-6.js"] }
  };
  var dicts = {};            // lang → { exact:Map, lower:Map, pats:[], rev:null, n }
  var cache = new Map();     // lang + "\u0001" + chuỗi → bản dịch | null
  var miss = new Map();      // chuỗi tiếng Việt chưa có bản dịch → số lần gặp
  var listeners = [];
  var protectSel = [];
  var lang = "vi";

  function norm(s){ return String(s == null ? "" : s).replace(/[\s ]+/g, " ").trim(); }
  function dictOf(l){ return dicts[l] || (dicts[l] = { exact: new Map(), lower: new Map(), pats: [], rev: null, n: 0 }); }
  function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function add(l, obj){
    var d = dictOf(l), k, key, val;
    for(k in obj){
      if(!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      key = norm(k); val = obj[k];
      if(!key || typeof val !== "string") continue;
      if(!d.exact.has(key)) d.n++;
      d.exact.set(key, val);
      var lk = key.toLowerCase();
      if(!d.lower.has(lk)) d.lower.set(lk, val);
      if(key.indexOf("{s}") >= 0){
        var kinds = [];
        var src = "^" + key.split(/(\{s\}|\{n\})/).map(function(p){
          if(p === "{s}"){ kinds.push("s"); return "(.+?)"; }
          if(p === "{n}"){ kinds.push("n"); return "(\\d+(?:[.,]\\d+)*)"; }
          return escRe(p);
        }).join("") + "$";
        try{ d.pats.push({ re: new RegExp(src, "i"), out: val, kinds: kinds, lit: key.replace(/\{[sn]\}/g, "").length }); }catch(e){}
        d.sorted = false;
      }
    }
    d.rev = null;
    cache.clear();
    if(l === lang && l !== "vi" && domReady) scheduleFull();
  }

  /* điền biến vào bản dịch */
  function fill(out, caps, l, depth){
    var i = 0, firstNum = null;
    for(var c = 0; c < caps.length; c++){ if(/^\d/.test(caps[c].v)){ firstNum = caps[c].v; break; } }
    var vals = caps.map(function(c){
      if(c.k === "s" && depth < 3){ var t = lookup(norm(c.v), l, depth + 1); return t == null ? c.v : t; }
      return c.v;
    });
    var s = out.replace(/\{(n|s|\d+)\}/g, function(_, k){
      if(k === "n" || k === "s"){ var v = vals[i++]; return v == null ? "" : v; }
      var v2 = vals[+k - 1]; return v2 == null ? "" : v2;
    });
    if(s.indexOf("[[") >= 0) s = s.replace(/\[\[([^|\]]*)\|([^\]]*)\]\]/g, function(_, one, many){
      return (firstNum != null && parseFloat(String(firstNum).replace(",", ".")) === 1 && !/[.,]/.test(firstNum)) ? one : many;
    });
    return s;
  }
  function recase(src, out){
    if(src === src.toUpperCase() && src !== src.toLowerCase() && src.length > 1) return out.toUpperCase();
    var a = src.charAt(0);
    if(a !== a.toLowerCase() && out.charAt(0) === out.charAt(0).toLowerCase()) return out.charAt(0).toUpperCase() + out.slice(1);
    return out;
  }
  /* các bước tra KHÔNG tách mảnh */
  function direct(s, d, l, depth){
    var v = d.exact.get(s);
    if(v != null) return fill(v, [], l, depth);
    var low = s.toLowerCase();
    v = d.lower.get(low);
    if(v != null && low.indexOf("{") < 0) return recase(s, fill(v, [], l, depth));
    if(/\d/.test(s)){
      var nums = [];
      var k = s.replace(NUM_RE, function(m){ nums.push({ k: "n", v: m }); return "{n}"; });
      v = d.exact.get(k);
      if(v != null) return fill(v, nums, l, depth);
      v = d.lower.get(k.toLowerCase());
      if(v != null) return recase(s, fill(v, nums, l, depth));
    }
    if(d.pats.length){
      if(!d.sorted){ d.pats.sort(function(a, b){ return b.lit - a.lit; }); d.sorted = true; }
      for(var i = 0; i < d.pats.length; i++){
        var p = d.pats[i], m = p.re.exec(s);
        if(m){
          var caps = [];
          for(var j = 1; j < m.length; j++) caps.push({ k: p.kinds[j - 1], v: m[j] });
          return recase(s, fill(p.out, caps, l, depth));
        }
      }
    }
    return null;
  }
  function withAffix(s, d, l, depth){
    var r = direct(s, d, l, depth);
    if(r != null) return r;
    var m = /^([^A-Za-z0-9À-ɏḀ-ỿ{]*)([\s\S]*?)([^A-Za-z0-9À-ɏḀ-ỿ}%]*)$/.exec(s);
    if(m && m[2] && (m[1] || m[3])){
      r = direct(m[2], d, l, depth);
      if(r != null) return m[1] + r + m[3];
    }
    return null;
  }
  /* "Đẩy ngực (Bench Press)" → "Bench Press" (tên bài tập / thuật ngữ đã kèm tiếng Anh) */
  function parenEnglish(s){
    var m = /^([^()]{2,60}?)\s*\(([A-Z][A-Za-z0-9 '\/&.,+-]{3,60})\)$/.exec(s);
    if(m && VI_RE.test(m[1]) && !VI_RE.test(m[2]) && /[a-z]{2}/.test(m[2])) return m[2];
    return null;
  }
  function lookup(s, l, depth){
    var d = dicts[l];
    if(!d || !s) return null;
    depth = depth || 0;
    var r = withAffix(s, d, l, depth);
    if(r != null) return r;
    if(SPLIT_RE.test(s) && depth < 3){
      var parts = s.split(SPLIT_RE), hit = false, bad = false, out = "";
      for(var i = 0; i < parts.length; i++){
        var p = parts[i];
        if(i % 2){ out += p; continue; }
        var core = norm(p);
        if(!core || !LETTER_RE.test(core)){ out += p; continue; }
        var t = withAffix(core, d, l, depth + 1);
        if(t == null) t = parenEnglish(core);
        if(t == null){ if(VI_RE.test(core)){ bad = true; note(core); } out += p; }
        else { hit = true; out += p.replace(core, function(){ return t; }); }
      }
      if(hit) return out;
      if(bad) return null;
    }
    return parenEnglish(s);
  }
  function note(s){
    if(miss.size < 4000 || miss.has(s)) miss.set(s, (miss.get(s) || 0) + 1);
  }
  /** dịch có nhớ đệm; null = không có bản dịch */
  function translate(s, l){
    l = l || lang;
    if(l === "vi") return null;
    s = norm(s);
    if(!s || !LETTER_RE.test(s)) return null;
    var key = l + "\u0001" + s;
    if(cache.has(key)) return cache.get(key);
    var r = lookup(s, l, 0);
    if(r === s) r = null;
    if(r == null && VI_RE.test(s) && dicts[l] && dicts[l].n) note(s);
    if(cache.size > 8000) cache.clear();
    cache.set(key, r);
    return r;
  }
  function t(s, l){
    var r = translate(s, l);
    return r == null ? String(s == null ? "" : s) : r;
  }

  /* ---------------- định dạng theo ngôn ngữ ---------------- */
  function locale(){ return (LANGS[lang] && LANGS[lang].locale) || "vi-VN"; }
  function fmtNum(n, opts){
    try{ return new Intl.NumberFormat(locale(), opts || {}).format(n); }catch(e){ return String(n); }
  }
  function fmtDate(d, opts){
    var dt = d instanceof Date ? d : new Date(d);
    if(isNaN(dt)) return "";
    try{ return new Intl.DateTimeFormat(locale(), opts || { day: "2-digit", month: "2-digit", year: "numeric" }).format(dt); }catch(e){ return dt.toDateString(); }
  }

  /* ---------------- lớp DOM ---------------- */
  var textStore = typeof WeakMap === "function" ? new WeakMap() : null;   // text node → { src, out }
  var attrStore = typeof WeakMap === "function" ? new WeakMap() : null;   // element → { attr: { src, out } }
  var observer = null, pending = [], scheduled = false, fullPending = false, domReady = false, applying = false;
  var stats = { flushes: 0, nodes: 0, full: 0 };

  function isSkippedEl(el){
    if(!el || el.nodeType !== 1) return false;
    if(SKIP_TAGS[el.nodeName]) return true;
    if(el.hasAttribute && (el.hasAttribute("data-no-i18n") || el.isContentEditable === true || el.getAttribute("contenteditable") === "true" || el.getAttribute("contenteditable") === "")) return true;
    var cn = el.className;
    if(typeof cn === "string" && cn.indexOf("material-symbols") >= 0) return true;        // chữ nối của icon
    if(protectSel.length && el.matches){
      try{ if(el.matches(protectSel.join(","))) return true; }catch(e){}
    }
    return false;
  }
  function inSkipped(node){
    for(var p = node && node.parentNode; p && p.nodeType === 1; p = p.parentNode) if(isSkippedEl(p)) return true;
    return false;
  }
  function trText(node){
    var cur = node.nodeValue;
    if(!cur) return;
    var rec = textStore.get(node);
    if(rec && rec.out === cur) return;                 // chính mình vừa dịch → bỏ qua (chống lặp)
    var out = translate(cur, lang);
    if(out == null){ if(rec) textStore.delete(node); return; }
    var lead = /^[\s ]*/.exec(cur)[0], trail = /[\s ]*$/.exec(cur)[0];
    var val = lead + out + trail;
    textStore.set(node, { src: cur, out: val });
    node.nodeValue = val;
    stats.nodes++;
  }
  function trAttr(el, name){
    var cur = el.getAttribute(name);
    if(!cur) return;
    var map = attrStore.get(el), rec = map && map[name];
    if(rec && rec.out === cur) return;
    var out = translate(cur, lang);
    if(out == null){ if(rec) delete map[name]; return; }
    if(!map){ map = {}; attrStore.set(el, map); }
    map[name] = { src: cur, out: out };
    el.setAttribute(name, out);
    stats.nodes++;
  }
  function trAttrs(el){
    if(!el.getAttribute) return;
    for(var i = 0; i < ATTRS.length; i++) if(el.hasAttribute(ATTRS[i])) trAttr(el, ATTRS[i]);
    if(el.nodeName === "INPUT"){
      var ty = (el.getAttribute("type") || "").toLowerCase();
      if((ty === "button" || ty === "submit" || ty === "reset") && el.hasAttribute("value")) trAttr(el, "value");
    }
  }
  /* đi cả cây con (lặp, không đệ quy) */
  function walk(root, fnText, fnEl){
    var stack = [root];
    while(stack.length){
      var n = stack.pop();
      if(!n) continue;
      if(n.nodeType === 3){ fnText(n); continue; }
      if(n.nodeType !== 1 && n.nodeType !== 9 && n.nodeType !== 11) continue;
      if(n.nodeType === 1){
        if(isSkippedEl(n)) continue;
        fnEl(n);
      }
      var kids = n.childNodes;
      if(kids) for(var i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
    }
  }
  function translateTree(root){
    if(!textStore || lang === "vi" || !dicts[lang] || !root) return;
    if(root.nodeType === 3){ if(!inSkipped(root)) trText(root); return; }
    if(root.nodeType === 1 && (isSkippedEl(root) || inSkipped(root))) return;
    walk(root, trText, trAttrs);
  }
  function restoreTree(root, fromLang){
    if(!textStore || !root) return;
    var d = dicts[fromLang], rev = null;
    function reverse(){
      if(rev || !d) return rev;
      rev = d.rev;
      if(!rev){ rev = d.rev = new Map(); d.exact.forEach(function(en, vi){ if(vi.indexOf("{") < 0 && en.indexOf("{") < 0 && en.indexOf("[[") < 0 && !rev.has(en)) rev.set(en, vi); }); }
      return rev;
    }
    walk(root, function(n){
      var rec = textStore.get(n);
      if(rec){ if(n.nodeValue === rec.out) n.nodeValue = rec.src; textStore.delete(n); return; }
      // chữ đã dịch bị mã app chép lại (vd nút "Đang lưu…" trả về nhãn cũ) → tra ngược
      var cur = n.nodeValue, core = cur && norm(cur);
      if(core && LETTER_RE.test(core) && !VI_RE.test(core) && reverse() && rev.has(core)) n.nodeValue = cur.replace(core, function(){ return rev.get(core); });
    }, function(el){
      var map = attrStore.get(el);
      if(!map) return;
      for(var k in map){ if(el.getAttribute(k) === map[k].out) el.setAttribute(k, map[k].src); }
      attrStore.delete(el);
    });
  }

  function flush(){
    scheduled = false;
    if(lang === "vi" || !dicts[lang]){ pending.length = 0; fullPending = false; return; }
    applying = true;
    stats.flushes++;
    try{
      if(fullPending){
        fullPending = false; pending.length = 0; stats.full++;
        translateTree(D.documentElement);
      } else {
        var list = pending; pending = [];
        for(var i = 0; i < list.length; i++){
          var m = list[i];
          if(m.type === "childList"){
            for(var j = 0; j < m.addedNodes.length; j++){
              var n = m.addedNodes[j];
              if(n.isConnected === false) continue;
              translateTree(n);
            }
          } else if(m.type === "characterData"){
            if(m.target.isConnected !== false && !inSkipped(m.target)) trText(m.target);
          } else if(m.type === "attributes"){
            var el = m.target;
            if(el.isConnected !== false && !isSkippedEl(el) && !inSkipped(el)) trAttr(el, m.attributeName);
          }
        }
      }
    }catch(e){ try{ W.console && console.warn("[i18n]", e); }catch(_){} }
    if(observer && observer.takeRecords) observer.takeRecords();     // bỏ các thay đổi do CHÍNH lớp dịch gây ra
    applying = false;
    unveil();
  }
  function schedule(){
    if(scheduled) return;
    scheduled = true;
    var raf = W.requestAnimationFrame;
    if(typeof raf === "function" && D && D.visibilityState !== "hidden"){
      var done = false, run = function(){ if(done) return; done = true; flush(); };
      raf(run); setTimeout(run, 250);                 // tab nền: rAF không chạy → dự phòng
    } else setTimeout(flush, 30);
  }
  function scheduleFull(){ fullPending = true; schedule(); }
  function onMutations(list){
    if(applying) return;
    for(var i = 0; i < list.length; i++) pending.push(list[i]);
    if(pending.length > 4000){ pending.length = 0; fullPending = true; }
    schedule();
  }
  function startObserver(){
    if(observer || !D || typeof W.MutationObserver !== "function" || !D.documentElement) return;
    observer = new W.MutationObserver(onMutations);
    observer.observe(D.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(["value"]) });
  }
  function stopObserver(){
    if(observer){ try{ observer.disconnect(); }catch(e){} observer = null; }
    pending.length = 0; fullPending = false;
  }

  /* che app tới khi dịch xong lượt đầu (mở app ở ngôn ngữ ≠ vi) — tối đa 1,5 s */
  var veilTimer = null;
  function veil(){
    if(!D || !D.documentElement || !D.documentElement.classList) return;
    D.documentElement.classList.add("fk-i18n-wait");
    clearTimeout(veilTimer); veilTimer = setTimeout(unveil, 1500);
  }
  function unveil(){
    if(veilTimer){ clearTimeout(veilTimer); veilTimer = null; }
    if(D && D.documentElement && D.documentElement.classList) D.documentElement.classList.remove("fk-i18n-wait");
  }

  /* ---------------- nạp từ điển (lười) ---------------- */
  var loading = {};
  function loadDict(l){
    var L = LANGS[l];
    if(!L) return Promise.reject(new Error("i18n: chưa hỗ trợ ngôn ngữ \"" + l + "\""));
    var files = L.files || [];
    var reg = W.__fkLazyDone = W.__fkLazyDone || {};
    var have = function(){ return !files.length || files.every(function(f){ return reg[f]; }) || (L.loaded === true); };
    if(have()){ L.loaded = true; return Promise.resolve(); }
    if(loading[l]) return loading[l];
    if(!D || !D.createElement) return dicts[l] && dicts[l].n ? Promise.resolve() : Promise.reject(new Error("i18n: không có DOM để tải từ điển"));
    var p = loading[l] = Promise.all(files.map(function(src){
      if(reg[src]) return null;
      return new Promise(function(res, rej){
        var s = D.createElement("script");
        s.src = src; s.async = false; s.setAttribute("data-fk-i18n", l);
        s.onload = function(){ reg[src] = 1; res(); };
        s.onerror = function(){ try{ s.parentNode && s.parentNode.removeChild(s); }catch(e){} rej(new Error("i18n: không tải được " + src)); };
        (D.head || D.documentElement).appendChild(s);
      });
    })).catch(function(err){
      // bản ghép 1 file: từ điển được nhúng sẵn phía dưới trang → chờ phân tích xong rồi kiểm lại
      return new Promise(function(res, rej){
        var check = function(){ (have() || (dicts[l] && dicts[l].n > 50)) ? res() : rej(err); };
        if(D.readyState === "loading") D.addEventListener("DOMContentLoaded", check, { once: true }); else check();
      });
    }).then(function(){ L.loaded = true; delete loading[l]; }, function(e){ delete loading[l]; throw e; });
    return p;
  }

  /* ---------------- đổi ngôn ngữ ---------------- */
  function applyHtmlLang(){
    try{ if(D && D.documentElement && D.documentElement.setAttribute) D.documentElement.setAttribute("lang", lang); }catch(e){}
  }
  function emit(){
    listeners.slice().forEach(function(cb){ try{ cb(lang); }catch(e){} });
    try{ if(D && D.dispatchEvent && W.CustomEvent) D.dispatchEvent(new W.CustomEvent("fk:lang", { detail: { lang: lang } })); }catch(e){}
    syncUI();
  }
  var switching = 0;
  function setLang(code, opts){
    code = String(code || "vi").toLowerCase();
    if(!LANGS[code]) return Promise.reject(new Error("i18n: chưa hỗ trợ ngôn ngữ \"" + code + "\""));
    var save = !(opts && opts.save === false);
    var ticket = ++switching;
    if(code === lang && (code === "vi" || (dicts[code] && LANGS[code].loaded))){
      if(save) store(code);
      return Promise.resolve(lang);
    }
    if(code === "vi"){
      var prev = lang;
      stopObserver();
      lang = "vi"; cache.clear();
      if(save) store("vi");
      applyHtmlLang();
      if(D && D.documentElement) restoreTree(D.documentElement, prev);
      unveil(); emit();
      return Promise.resolve(lang);
    }
    return loadDict(code).then(function(){
      if(ticket !== switching) return lang;                       // người dùng đã bấm lựa chọn khác
      var prev = lang;
      if(prev !== "vi" && prev !== code && D && D.documentElement){ stopObserver(); restoreTree(D.documentElement, prev); }
      lang = code; cache.clear();
      if(save) store(code);
      applyHtmlLang();
      if(D && D.documentElement){
        applying = true;
        try{ translateTree(D.documentElement); stats.full++; }finally{ applying = false; }
        startObserver();
        if(observer && observer.takeRecords) observer.takeRecords();
      }
      unveil(); emit();
      return lang;
    }, function(e){
      unveil();
      if(ticket === switching) say(lang === "vi" ? "Chưa tải được gói ngôn ngữ — kiểm tra mạng rồi thử lại." : "Couldn't load the language pack. Check your connection and try again.");
      throw e;
    });
  }
  function store(code){ try{ W.localStorage && W.localStorage.setItem(LS_KEY, code); }catch(e){} }
  function stored(){ try{ return (W.localStorage && W.localStorage.getItem(LS_KEY)) || ""; }catch(e){ return ""; } }
  function say(msg){ try{ if(typeof W.toast === "function") W.toast(msg); }catch(e){} }

  /* ---------------- giao diện chọn ngôn ngữ ---------------- */
  var GLOBE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/></svg>';
  function h(tag, attrs, html){
    var el = D.createElement(tag);
    for(var k in attrs || {}) el.setAttribute(k, attrs[k]);
    if(html != null) el.innerHTML = html;
    return el;
  }
  function langName(l){ return (LANGS[l] && LANGS[l].name) || l; }

  function openPicker(){
    if(!D || !D.body || D.getElementById("fk-lang-dlg")) return;
    var opener = D.activeElement;
    var wrap = h("div", { id: "fk-lang-dlg", "class": "fk-lang-dlg", "data-no-i18n": "", role: "dialog", "aria-modal": "true", "aria-labelledby": "fk-lang-h" });
    var rows = Object.keys(LANGS).map(function(l){
      return '<button type="button" class="fk-lang-opt" role="radio" aria-checked="' + (l === lang) + '" data-lang="' + l + '" lang="' + l + '">' +
        '<span class="fk-lang-name">' + langName(l) + '</span><span class="fk-lang-code">' + l.toUpperCase() + '</span><span class="fk-lang-tick" aria-hidden="true">✓</span></button>';
    }).join("");
    wrap.innerHTML = '<div class="fk-lang-card"><h2 id="fk-lang-h">Ngôn ngữ · Language</h2><div role="radiogroup" aria-labelledby="fk-lang-h" class="fk-lang-list">' + rows +
      '</div><p class="fk-lang-note">' + (lang === "vi"
        ? "Bản tiếng Anh dịch tự động phần giao diện; bài viết dài và công thức nấu vẫn bằng tiếng Việt."
        : "English covers the interface. Long articles and recipes are still in Vietnamese.") +
      '</p><button type="button" class="fk-lang-close">' + (lang === "vi" ? "Đóng" : "Close") + '</button></div>';
    function close(){
      D.removeEventListener("keydown", onKey, true);
      if(wrap.parentNode) wrap.parentNode.removeChild(wrap);
      try{ opener && opener.focus && opener.focus(); }catch(e){}
    }
    function onKey(e){
      if(e.key === "Escape"){ e.stopPropagation(); close(); return; }
      if(e.key === "Tab"){
        var f = wrap.querySelectorAll("button"), first = f[0], last = f[f.length - 1];
        if(e.shiftKey && D.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && D.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    }
    wrap.addEventListener("click", function(e){
      var b = e.target.closest ? e.target.closest("[data-lang]") : null;
      if(b){
        var l = b.getAttribute("data-lang");
        close();
        setLang(l).then(function(){ say(l === "vi" ? "Đã chuyển sang Tiếng Việt" : "Switched to " + langName(l)); }, function(){});
        return;
      }
      if(e.target === wrap || (e.target.closest && e.target.closest(".fk-lang-close"))) close();
    });
    D.addEventListener("keydown", onKey, true);
    D.body.appendChild(wrap);
    var cur = wrap.querySelector('[aria-checked="true"]') || wrap.querySelector("button");
    try{ cur && cur.focus(); }catch(e){}
  }

  /* (1) nút nổi ở màn chào / đăng nhập — gắn vào #auth (không bị pt.js vẽ lại xoá mất) */
  function ensureAuthButton(){
    var auth = D.getElementById("auth");
    if(!auth || D.getElementById("fk-lang-auth")) return;
    var b = h("button", { type: "button", id: "fk-lang-auth", "class": "fk-lang-chip", "data-no-i18n": "", "aria-label": "Ngôn ngữ / Language" });
    b.addEventListener("click", openPicker);
    auth.appendChild(b);
  }
  /* (2) mục "Ngôn ngữ / Language" trong Hồ sơ → trước thẻ tài khoản */
  function ensureProfileRow(){
    if(D.getElementById("fk-lang-row")) return;
    var scr = D.getElementById("screen-profile");
    if(!scr) return;
    var anchor = D.getElementById("profile-account-card");
    var card = h("div", { "class": "card fk-lang-cardrow", id: "fk-lang-row", "data-no-i18n": "" },
      '<button type="button" class="list-item fk-lang-item" id="btn-lang" aria-haspopup="dialog">' +
      '<span class="thumb fk-lang-thumb" aria-hidden="true">' + GLOBE + '</span>' +
      '<span class="info"><span class="name">Ngôn ngữ · Language</span><span class="meta" id="fk-lang-cur"></span></span>' +
      '<span class="trailing" aria-hidden="true">›</span></button>');
    if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor);
    else (scr.querySelector(".content") || scr).appendChild(card);
  }
  function bindProfileRow(){
    var b = D.getElementById("btn-lang");
    if(b && !b.__fkLang){ b.__fkLang = 1; b.addEventListener("click", openPicker); }
  }
  function syncUI(){
    if(!D || !D.getElementById) return;
    var a = D.getElementById("fk-lang-auth");
    if(a && a.innerHTML != null) a.innerHTML = GLOBE + "<span>" + lang.toUpperCase() + "</span>";
    var c = D.getElementById("fk-lang-cur");
    if(c) c.textContent = langName(lang);
  }
  /* dải gợi ý lần đầu: máy không dùng tiếng Việt → mời chuyển English (KHÔNG tự đổi) */
  function maybeHint(){
    try{
      if(stored() || W.localStorage.getItem(LS_HINT)) return;
      var nl = String((W.navigator && (W.navigator.language || (W.navigator.languages || [])[0])) || "vi").toLowerCase();
      if(nl.indexOf("vi") === 0 || !D.body) return;
      var bar = h("div", { id: "fk-lang-hint", "class": "fk-lang-hint", "data-no-i18n": "", role: "region", "aria-label": "Language" },
        '<span>Prefer English?</span><button type="button" class="fk-lang-hint-yes">Switch to English</button><button type="button" class="fk-lang-hint-no" aria-label="Dismiss">✕</button>');
      var done = function(){ try{ W.localStorage.setItem(LS_HINT, "1"); }catch(e){} if(bar.parentNode) bar.parentNode.removeChild(bar); };
      bar.querySelector(".fk-lang-hint-yes").addEventListener("click", function(){ done(); setLang("en").catch(function(){}); });
      bar.querySelector(".fk-lang-hint-no").addEventListener("click", done);
      D.body.appendChild(bar);
    }catch(e){}
  }
  function mountUI(){
    if(!D || !D.getElementById || !D.createElement) return;
    try{ ensureAuthButton(); ensureProfileRow(); bindProfileRow(); syncUI(); }catch(e){}
  }

  /* ---------------- khởi động ---------------- */
  function boot(){
    domReady = true;
    mountUI();
    maybeHint();
    if(lang !== "vi" && dicts[lang]) scheduleFull();
    // màn Hồ sơ / đăng nhập bị vẽ lại → chèn lại nếu mất (quan sát hẹp: chỉ 2 nút gốc, không subtree)
    try{
      if(typeof W.MutationObserver === "function"){
        var mo = new W.MutationObserver(function(){ mountUI(); });
        ["auth", "screen-profile"].forEach(function(id){ var el = D.getElementById(id); if(el && el.nodeType === 1) mo.observe(el, { childList: true }); });
        var pc = D.querySelector && D.querySelector("#screen-profile .content");
        if(pc && pc.nodeType === 1) mo.observe(pc, { childList: true });
      }
    }catch(e){}
  }

  var api = W.FK_I18N = {
    __v: 1,
    get lang(){ return lang; },
    get langs(){ return Object.keys(LANGS).map(function(l){ return { code: l, name: LANGS[l].name }; }); },
    setLang: setLang,
    t: t,
    translate: translate,
    norm: norm,
    add: add,
    size: function(l){ return dicts[l || "en"] ? dicts[l || "en"].n : 0; },
    register: function(code, def){ LANGS[String(code).toLowerCase()] = Object.assign({ name: code, locale: code, files: [] }, def || {}); },
    protect: function(sel){ if(sel && protectSel.indexOf(sel) < 0) protectSel.push(sel); },
    onChange: function(cb){ if(typeof cb === "function") listeners.push(cb); return function(){ var i = listeners.indexOf(cb); if(i >= 0) listeners.splice(i, 1); }; },
    fmtNum: fmtNum,
    fmtDate: fmtDate,
    missing: function(){ return Array.from(miss.entries()).sort(function(a, b){ return b[1] - a[1]; }); },
    openPicker: openPicker,
    translateTree: translateTree,
    restoreTree: restoreTree,
    _flush: flush,
    _stats: stats,
    _mountUI: mountUI
  };

  /* nội dung người dùng nhập đã biết ở các module (không dịch kể cả khi trùng từ điển) */
  ["#profile-name", "#client-title", ".cm-post-text", ".cm-cmt-text", ".chat-bubble", ".pc-msg", ".fp-rv-text", ".ev-desc-user", ".adm-user-name", "[data-user-text]"].forEach(api.protect);

  var first = stored();
  if(first && first !== "vi" && LANGS[first]){
    veil();
    setLang(first, { save: false }).catch(function(){});
  }
  if(D && D.addEventListener){
    if(D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
  }
})();

/* =========================================================================
   TapEasy — fkLazy: nạp lười nhóm DỮ LIỆU lớn (vòng 2 sửa lỗi · ux · QU-01)
   Hợp đồng: docs/qa/HANDOFF-ROUND-BRIEF.md §"Hợp đồng nạp lười dữ liệu (fkLazy)". Nạp trong <head> (sau themes.js)
   để mọi file sau gọi được kể cả lúc đang phân tích trang.

     await (window.fkLazy ? fkLazy.load("exdbvi") : Promise.resolve());   // trước khi đọc EXDB_VI
     await (window.fkLazy ? fkLazy.load("kb") : Promise.resolve());       // trước khi đọc KB_ARTICLES / KB_GLOSSARY / KB_FAQ

   Nhóm (khai báo trong index.html bằng <script type="text/fk-lazy" data-group="…" src="…"> — trình duyệt KHÔNG
   tải/chạy thẻ kiểu này; danh sách GROUPS dưới đây là dự phòng khi trang không có khai báo):
     exdbvi = exdb-vi-1.js, exdb-vi-2.js, exdb-vi-3.js    bản dịch 800+ bài (exdb-vi.js là MÃ ghi đè hàm → vẫn nạp sẵn)
     kb     = kb-data-1.js … kb-data-6.js                  Kho kiến thức (bài, thuật ngữ, hỏi đáp)

   - Nạp TUẦN TỰ đúng thứ tự; gọi nhiều lần / song song = cùng 1 Promise; nhóm đã nạp → resolve ngay.
   - Dữ liệu đã có sẵn (thẻ <script> thường, bản ghép 1 file đăng ký trong window.__fkLazyDone, môi trường test)
     → resolve ngay, KHÔNG tải lại (kb-data-*.js push vào mảng → tải 2 lần sẽ nhân đôi bài).
   - Lỗi mạng / quá TIMEOUT_MS → reject(Error) để module hiện trạng thái lỗi + nút "Thử lại"; lần gọi sau thử lại
     (file đã chạy xong không tải lại; file đang treo không chèn thẻ thứ hai).
   - Xong nhóm → phát sự kiện document "fk:lazy" (detail.group) + "fk:lazy:<nhóm>" để màn đang mở vẽ lại.
   - Lúc rảnh sau khi mở app (~4 s sau "load") nạp trước các nhóm, trừ Save-Data / mạng 2G — để lúc người dùng
     mở Thư viện / Kho kiến thức dữ liệu thường đã sẵn.
   API phụ: fkLazy.loaded(g) → bool · fkLazy.files(g) → [src] · fkLazy.groups() → [tên] · fkLazy.prefetch([g])
   ========================================================================= */
(function(){
  "use strict";
  if(window.fkLazy && window.fkLazy.__v) return;

  var TIMEOUT_MS = 20000;
  var GROUPS = {
    exdbvi: ["exdb-vi-1.js", "exdb-vi-2.js", "exdb-vi-3.js"],
    kb: ["kb-data-1.js", "kb-data-2.js", "kb-data-3.js", "kb-data-4.js", "kb-data-5.js", "kb-data-6.js"]
  };
  /* "Dữ liệu đã có" — khi file được nạp bằng thẻ thường (bản cũ / test Node) thì không có trong sổ đăng ký */
  var READY = {
    exdbvi: function(){ var v = window.EXDB_VI; return !!v && typeof v === "object" && Object.keys(v).length >= 800; },
    kb: function(){
      var a = window.KB_ARTICLES, g = window.KB_GLOSSARY, f = window.KB_FAQ;
      return Array.isArray(a) && a.length > 0 && Array.isArray(g) && g.length > 0 && Array.isArray(f) && f.length > 0;
    }
  };

  var done = window.__fkLazyDone = window.__fkLazyDone || {};   // src → 1 khi file đã chạy
  var files = {};       // src → Promise của thẻ <script> đang tải (giữ tới khi xong/lỗi)
  var groupP = {};      // nhóm → Promise đang chạy
  var groupOk = {};     // nhóm → true khi đã nạp xong
  var declared = null;  // khai báo đọc từ index.html (1 lần)

  function readDeclared(){
    if(declared) return declared;
    var out = {};
    try{
      var list = document.querySelectorAll ? document.querySelectorAll('script[type="text/fk-lazy"][data-group]') : [];
      for(var i = 0; i < list.length; i++){
        var s = list[i], g = s.getAttribute("data-group"), src = s.getAttribute("src");
        if(!g || !src) continue;
        (out[g] = out[g] || []).push(src);
      }
    }catch(e){}
    if(document.readyState !== "loading") declared = out;   // đang phân tích trang → đọc lại sau
    return out;
  }
  function filesOf(g){
    var d = readDeclared();
    return (d[g] && d[g].length) ? d[g].slice() : (GROUPS[g] ? GROUPS[g].slice() : null);
  }
  function whenParsed(){
    if(document.readyState !== "loading") return Promise.resolve();
    return new Promise(function(res){ document.addEventListener("DOMContentLoaded", function(){ res(); }, { once: true }); });
  }
  function isReady(g){
    var list = filesOf(g) || [];
    if(list.length && list.every(function(f){ return done[f]; })) return true;
    try{ return !!(READY[g] && READY[g]()); }catch(e){ return false; }
  }

  /* Chèn 1 thẻ <script> (thay được trong test qua fkLazy._inject) */
  function injectScript(src){
    return new Promise(function(res, rej){
      var s = document.createElement("script");
      s.src = src; s.async = false;
      s.setAttribute("data-fk-lazy", "1");
      s.onload = function(){ res(); };
      s.onerror = function(){
        try{ if(s.parentNode) s.parentNode.removeChild(s); }catch(e){}
        rej(new Error("fkLazy: không tải được " + src));
      };
      (document.head || document.body || document.documentElement).appendChild(s);
    });
  }
  function loadFile(src){
    if(done[src]) return Promise.resolve();
    var p = files[src];
    if(!p){
      p = files[src] = Promise.resolve().then(function(){ return api._inject(src); })
        .then(function(){ done[src] = 1; delete files[src]; },
              function(e){ delete files[src]; throw e; });     // lỗi → quên để lần sau chèn lại
    }
    var timer;
    var to = new Promise(function(_, rej){
      timer = setTimeout(function(){ rej(new Error("fkLazy: quá thời gian tải " + src)); }, TIMEOUT_MS);
    });
    // quá giờ: chỉ báo lỗi cho lần gọi này, thẻ vẫn giữ (nếu tải xong muộn → đánh dấu đã nạp, không chèn trùng)
    return Promise.race([p, to]).then(function(v){ clearTimeout(timer); return v; }, function(e){ clearTimeout(timer); throw e; });
  }
  function emit(g){
    try{
      var CE = window.CustomEvent;
      document.dispatchEvent(new CE("fk:lazy", { detail: { group: g } }));
      document.dispatchEvent(new CE("fk:lazy:" + g, { detail: { group: g } }));
    }catch(e){}
  }

  function load(group){
    var g = String(group || "");
    if(!filesOf(g)) return Promise.reject(new Error("fkLazy: không có nhóm \"" + g + "\""));
    if(groupOk[g]) return Promise.resolve();
    if(groupP[g]) return groupP[g];
    var p = groupP[g] = whenParsed().then(function(){
      declared = null;                                           // đọc lại khai báo khi trang đã phân tích xong
      if(isReady(g)){ (filesOf(g) || []).forEach(function(f){ done[f] = 1; }); return; }
      return (filesOf(g) || []).reduce(function(chain, src){
        return chain.then(function(){ return loadFile(src); });
      }, Promise.resolve());
    }).then(function(){
      groupOk[g] = true; delete groupP[g]; emit(g);
    }, function(e){
      delete groupP[g];
      throw e;
    });
    return p;
  }

  function prefetch(list){
    list = list || Object.keys(Object.assign({}, GROUPS, readDeclared()));
    return list.reduce(function(chain, g){
      return chain.then(function(){ return load(g).catch(function(){}); });
    }, Promise.resolve());
  }

  var api = {
    __v: 1,
    load: load,
    loaded: function(g){ g = String(g || ""); return !!groupOk[g] || (!!filesOf(g) && document.readyState !== "loading" && isReady(g)); },
    files: function(g){ return filesOf(String(g || "")) || []; },
    groups: function(){ return Object.keys(Object.assign({}, GROUPS, readDeclared())); },
    prefetch: prefetch,
    _inject: injectScript,          // test thay hàm này
    _reset: function(g){ delete groupOk[g]; delete groupP[g]; }
  };
  window.fkLazy = api;

  /* Nạp trước lúc rảnh (không chặn khởi động) */
  try{
    var nc = navigator.connection || {};
    var slow = nc.saveData || /(^|-)2g$/.test(String(nc.effectiveType || ""));
    if(!slow && typeof window.addEventListener === "function"){
      window.addEventListener("load", function(){
        setTimeout(function(){
          var go = function(){ prefetch(); };
          if(typeof window.requestIdleCallback === "function") window.requestIdleCallback(go, { timeout: 6000 });
          else go();
        }, 4000);
      });
    }
  }catch(e){}
})();

/* TapEasy Shorts — shot bổ sung cho director.js của intro (KHÔNG sửa file intro).
   capture.py ghép: nội dung scripts/intro-video/director.js + file này → build/app/_dir/director.js rồi chạy capture_app.py
   của intro với BUILD/HERE trỏ sang thư mục shorts. Chỉ dữ liệu demo cục bộ, không đăng nhập tài khoản thật. */
(function(){
  "use strict";
  const TI = window.__TI;
  if(!TI || TI.__shorts) return;
  TI.__shorts = true;
  const $q = s => { try{ return document.querySelector(s); }catch(e){ return null; } };
  const add = (id, def) => { if(TI.shots[id]) return; TI.shots[id] = def; TI.order.push(id); };
  const go = async (screen, ms) => { await TI.closeAll(); try{ goto(screen); }catch(e){ TI.log.push("goto " + screen + " " + e.message); } const sc = $q("#app-scroll"); if(sc) sc.scrollTop = 0; await TI.settle(ms || 1200); };
  // giấc ngủ (dữ liệu ngủ 13 ngày do TI.seedHistory tạo ở shot home0)
  add("sleep", { setup: async () => { await go("sleep", 1500); }, scroller: "#app-scroll" });
  // tiến độ → tab chỉ số cơ thể (InBody, 5 mốc cân nặng/mỡ demo)
  add("progressInbody", { setup: async () => { await TI.closeAll(); try{ openProgress("inbody"); }catch(e){ try{ goto("progress"); }catch(_){} }
      const sc = $q("#app-scroll"); if(sc) sc.scrollTop = 0; await TI.settle(1500); }, scroller: "#app-scroll" });
})();

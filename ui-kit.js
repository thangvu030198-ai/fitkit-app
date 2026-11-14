/* =========================================================================
   TapEasy — UI KIT (ui-kit.js) · nạp sau pt.js (và sau themes.js nếu có)
   1. fkEmpty(icon, title, desc, cta)   → HTML trạng thái rỗng
      fkSkeleton(n, kind)               → HTML khung xương đang tải ("list" | "card" | "grid")
      fkError(msg, retry, opts)         → HTML lỗi + nút "Thử lại"
      fkLoad(el, loader, {skeleton, render, empty}) → tiện ích tải dữ liệu đủ 3 trạng thái
   2. Tự nâng cấp mọi <p class="empty-hint"> sẵn có (MutationObserver, không đổi nội dung/link)
   3. Ảnh <img> lỗi → placeholder gradient + icon theo theme (lắng nghe "error" capture toàn cục)
   4. Chế độ máy yếu: html.lowfx (tự bật khi hardwareConcurrency ≤ 4 hoặc giảm trong suốt)
      API window.fkFx.{mode(), set("auto"|"full"|"low"), active()} — lưu state.fxMode
   5. Lối tắt PWA (manifest shortcuts): ?go=workout | ?go=meal
   ========================================================================= */
(function(){
  "use strict";
  const esc = (s)=> (typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s))
    : String(s == null ? "" : s).replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])));

  /* ---------- icon bổ sung ---------- */
  try{
    if(typeof FK_LINE !== "undefined") Object.assign(FK_LINE, {
      inbox:"M22 12h-6l-2 3h-4l-2-3H2|M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z",
      search_off:"c:11,11,7|M21 21l-4.3-4.3|M8.5 8.5l5 5|M13.5 8.5l-5 5",
      cloud_off:"M2 2l20 20|M5.8 5.8A7 7 0 0 0 9 19h8.5|M21.5 17.2A4.5 4.5 0 0 0 17.5 10h-1.8A7 7 0 0 0 9.9 5.1",
      wifi_off:"M2 2l20 20|M8.5 16.5a5 5 0 0 1 7 0|M5 13a10 10 0 0 1 5.2-2.8|M19 13a10 10 0 0 0-2.4-1.7|M2 8.8a15 15 0 0 1 4.2-2.7|M22 8.8A15 15 0 0 0 10.7 5|M12 20h.01",
      image:"r:3,3,18,18,2|c:9,9,2|M21 15l-5-5L5 21",
      error_outline:"c:12,12,10|M12 8v5|M12 16h.01",
      hourglass_empty:"M6 2h12|M6 22h12|M7 2v4l5 6-5 6v4|M17 2v4l-5 6 5 6v4",
    });
  }catch(e){}

  /* ---------- 1. Component trạng thái ---------- */
  const ACTS = {}; let actSeq = 0;
  function reg(fn){ const id = "a" + (++actSeq); ACTS[id] = fn; return id; }
  window.fkAct = function(id, el){ try{ const f = ACTS[id]; if(f) f(el); }catch(e){ console.warn("[ui-kit]", e); } };
  function ctaHTML(cta, cls){
    if(!cta) return "";
    if(typeof cta === "string") cta = { label:cta };
    const icon = cta.icon ? `<span class="material-symbols-rounded">${esc(cta.icon)}</span>` : "";
    let on = "";
    if(typeof cta.onClick === "function") on = `onclick="fkAct('${reg(cta.onClick)}', this)"`;
    else if(typeof cta.onClick === "string") on = `onclick="${esc(cta.onClick)}"`;
    return `<button type="button" class="btn ${cls || cta.cls || "btn-primary"} btn-sm" ${on}>${icon}${esc(cta.label || "")}</button>`;
  }
  window.fkEmpty = function(icon, title, desc, cta, opts){
    opts = opts || {};
    return `<div class="fk-state fk-empty${opts.small ? " sm" : ""}" role="status">
      <div class="fk-state-ic" aria-hidden="true"><span class="material-symbols-rounded">${esc(icon || "inbox")}</span></div>
      <div class="fk-state-tx">${title ? `<b>${esc(title)}</b>` : ""}${desc ? `<p>${esc(desc)}</p>` : ""}</div>
      ${ctaHTML(cta)}
    </div>`;
  };
  window.fkSkeleton = function(n, kind){
    n = Math.max(1, Math.min(12, Number(n) || 3)); kind = kind || "list";
    let inner = "";
    for(let i=0;i<n;i++){
      if(kind === "card") inner += `<div class="fk-sk card"></div>`;
      else if(kind === "grid") inner += `<div class="fk-sk tile"></div>`;
      else inner += `<div class="fk-sk-row"><div class="fk-sk th"></div><div class="ln"><div class="fk-sk l1"></div><div class="fk-sk l2"></div></div></div>`;
    }
    return `<div class="fk-skel ${kind==="grid"?"grid":""}" role="status" aria-busy="true" aria-live="polite"><span class="fk-sr">Đang tải…</span>${inner}</div>`;
  };
  window.fkError = function(msg, retry, opts){
    opts = opts || {};
    const off = typeof navigator !== "undefined" && navigator.onLine === false;
    const title = opts.title || (off ? "Mất kết nối mạng" : "Chưa tải được dữ liệu");
    const desc = msg || (off ? "Kiểm tra Wi-Fi hoặc dữ liệu di động rồi thử lại nhé." : "Có lỗi khi tải. Bạn thử lại sau giây lát nhé.");
    const btn = retry ? ctaHTML({ label: opts.retryLabel || "Thử lại", icon:"refresh", onClick: retry }, "btn-outline") : "";
    return `<div class="fk-state err${opts.small ? " sm" : ""}" role="alert">
      <div class="fk-state-ic" aria-hidden="true"><span class="material-symbols-rounded">${off ? "wifi_off" : "error_outline"}</span></div>
      <div class="fk-state-tx"><b>${esc(title)}</b><p>${esc(desc)}</p></div>${btn}
    </div>`;
  };
  /* Tải dữ liệu đủ 3 trạng thái: skeleton → render | empty | lỗi + thử lại */
  window.fkLoad = async function(el, loader, o){
    o = o || {}; if(typeof el === "string") el = document.querySelector(el); if(!el) return;
    const run = async ()=>{
      el.innerHTML = window.fkSkeleton(o.count || 3, o.skeleton || "list");
      try{
        const data = await loader();
        const empty = data == null || (Array.isArray(data) && !data.length);
        if(empty && o.empty) el.innerHTML = window.fkEmpty.apply(null, o.empty);
        else if(o.render) { const h = o.render(data); if(typeof h === "string") el.innerHTML = h; }
        return data;
      }catch(err){
        el.innerHTML = window.fkError(o.errorMsg || (err && err.message) || "", run);
      }
    };
    return run();
  };

  /* ---------- 2. Nâng cấp .empty-hint có sẵn ---------- */
  const EH_ICONS = [
    [/ngày nghỉ/i, "self_improvement"], [/video|clip/i, "video_library"], [/ảnh/i, "photo_camera"],
    [/inbody|số liệu|dữ liệu|theo dõi/i, "insights"], [/món|thực phẩm|ăn/i, "restaurant"],
    [/không tìm thấy|tìm/i, "search_off"], [/bài tập|buổi/i, "fitness_center"], [/học viên|pt\b/i, "groups"],
  ];
  function upgradeHint(p){
    if(!p || p.dataset.fkEh) return;
    p.dataset.fkEh = "1";
    const txt = p.textContent || "";
    const ic = (EH_ICONS.find(([re])=> re.test(txt)) || [0, "inbox"])[1];
    const s = document.createElement("span");
    s.className = "material-symbols-rounded fk-eh-ic"; s.setAttribute("aria-hidden", "true"); s.textContent = ic;
    p.classList.add("fk-eh");
    if((p.getAttribute("style") || "").includes("padding") || txt.length < 34) p.classList.add("sm");
    p.insertBefore(s, p.firstChild);
    if(!p.hasAttribute("role")) p.setAttribute("role", "status");
  }
  function scanHints(root){
    if(!root || root.nodeType !== 1) return;
    if(root.classList.contains("empty-hint")) upgradeHint(root);
    const list = root.getElementsByClassName("empty-hint");
    for(let i=0;i<list.length;i++) upgradeHint(list[i]);
  }

  /* ---------- 3. Ảnh lỗi → placeholder ---------- */
  const PH_CACHE = {};
  const PH_ICON = {
    food:'<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5a2 2 0 0 0 2 2M9 3v5a2 2 0 0 1-2 2M17 21V3c-2 1-3.5 3.5-3.5 7 0 2 1.5 3 3.5 3"/>',
    person:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    gym:'<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
  };
  function cssVar(n, fb){ try{ const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || fb; }catch(e){ return fb; } }
  function phKind(img){
    const c = (img.className || "") + " " + (img.id || "") + " " + ((img.parentElement && img.parentElement.className) || "");
    if(/\bfp\b|fr-img|nu-|food|meal/i.test(c)) return "food";
    if(/avatar|profile/i.test(c)) return "person";
    if(/thumb|ex-|exlib|mg-|tpl|vp-|vthumb|hero|ld-img|clip/i.test(c)) return "gym";
    return "image";
  }
  function phSrc(kind){
    const light = document.documentElement.classList.contains("fk-light");
    const a = light ? "#DDE7EC" : cssVar("--navy-3", "#114650");
    const b = light ? "#C9D8DF" : cssVar("--navy", "#061A24");
    const ic = light ? cssVar("--mint", "#0A7360") : cssVar("--mint", "#5EE6C7");
    const key = kind + a + b + ic;
    if(PH_CACHE[key]) return PH_CACHE[key];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
      <rect width="120" height="120" fill="url(#g)"/>
      <g transform="translate(42 42) scale(1.5)" fill="none" stroke="${ic}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" opacity=".9">${PH_ICON[kind]}</g></svg>`;
    return (PH_CACHE[key] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  }
  function applyPh(img){
    if(!img || !img.isConnected || img.dataset.noFallback != null) return;
    const src = img.getAttribute("src");
    if(!src || src.startsWith("data:image/svg+xml") && img.dataset.fkPh) return;
    img.dataset.fkPh = "1";
    img.dataset.fkFailedSrc = src.slice(0, 300);
    img.classList.add("fk-img-ph");
    if(img.style.visibility === "hidden") img.style.visibility = "";
    if(img.style.opacity === "0") img.style.opacity = "";
    if(!img.getAttribute("alt")) img.setAttribute("alt", "");
    img.src = phSrc(phKind(img));
  }
  function onImgError(e){
    const img = e.target;
    if(!img || img.tagName !== "IMG") return;
    const src = img.getAttribute("src");
    if(!src || (img.dataset.fkPh && src.startsWith("data:image/svg+xml"))) return;
    if(img.hasAttribute("onerror")){
      // để handler riêng của app chạy trước (đổi nguồn dự phòng / thay emoji / gỡ ảnh)
      setTimeout(()=>{
        if(!img.isConnected || img.style.display === "none") return;           // app chủ động ẩn → tôn trọng
        if(img.getAttribute("src") !== src) return;                            // app đã đổi sang nguồn dự phòng
        applyPh(img);                                                          // ẩn/mờ ảnh hoặc hết nguồn dự phòng
      }, 0);
      return;
    }
    applyPh(img);
  }
  document.addEventListener("error", onImgError, true);
  function scanBrokenImages(){
    try{
      document.querySelectorAll("img[src]").forEach(img=>{
        if(img.complete && img.naturalWidth === 0 && img.getAttribute("src") && !img.dataset.fkPh && !img.hasAttribute("onerror")) applyPh(img);
      });
    }catch(e){}
  }

  /* ---------- 4. Chế độ máy yếu ---------- */
  const mqRT = window.matchMedia ? window.matchMedia("(prefers-reduced-transparency: reduce)") : null;
  function fxMode(){ try{ return (typeof state !== "undefined" && state && ["auto","full","low"].includes(state.fxMode)) ? state.fxMode : "auto"; }catch(e){ return "auto"; } }
  /* QU-05/QU-04: "tiết kiệm dữ liệu" (Save-Data hoặc mạng 2g) */
  function saveDataOn(){
    try{ const c = navigator.connection || {}; return !!c.saveData || /(^|-)2g$/.test(c.effectiveType || ""); }catch(e){ return false; }
  }
  function weakDevice(){
    if(mqRT && mqRT.matches) return true;
    if(saveDataOn()) return true;
    // WebKit trên iPhone/iPad cố ý báo số lõi thấp (chống dò vân tay) dù GPU xử lý blur tốt → không tính
    const ua = navigator.userAgent || "";
    const apple = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if(apple) return false;
    const hc = navigator.hardwareConcurrency || 8;
    const mem = navigator.deviceMemory || 8;
    return hc <= 4 || mem <= 4;   // QU-05: Android tầm trung (≤ 4 GB RAM hoặc ≤ 4 lõi) → bỏ kính mờ trong danh sách
  }
  function fxActive(){ const m = fxMode(); return m === "low" || (m === "auto" && weakDevice()); }
  function applyFx(){
    const r = document.documentElement;
    r.classList.toggle("lowfx", fxActive());
    r.classList.toggle("fk-fx-full", fxMode() === "full");
  }
  window.fkFx = {
    mode: fxMode, active: fxActive, weak: weakDevice,
    set(m){ if(!["auto","full","low"].includes(m)) return; try{ state.fxMode = m; saveState(); }catch(e){} applyFx(); }
  };
  if(mqRT){ const f = ()=> applyFx(); if(mqRT.addEventListener) mqRT.addEventListener("change", f); else if(mqRT.addListener) mqRT.addListener(f); }

  /* ---------- 5. Lối tắt PWA ---------- */
  let shortcutDone = false;
  function handleShortcut(){
    if(shortcutDone) return;
    let go = null;
    try{ go = new URLSearchParams(location.search).get("go"); }catch(e){}
    if(!go){ shortcutDone = true; return; }
    const auth = document.getElementById("auth"), ob = document.getElementById("onboarding");
    if((auth && auth.classList.contains("open")) || (ob && ob.classList.contains("open"))) return; // chờ đăng nhập xong
    shortcutDone = true;
    try{
      if(go === "workout" && typeof goto === "function") goto("workout");
      else if(go === "progress" && typeof goto === "function") goto("progress");            // R3: lối tắt "Tiến độ" (manifest.json)
      else if(go === "meal" && typeof goto === "function"){
        goto("nutrition");
        setTimeout(()=>{ const b = document.getElementById("nu-add"); if(b) b.click(); }, 350);
      }
      if(history.replaceState) history.replaceState(null, "", location.pathname);
    }catch(e){}
  }

  /* =======================================================================
     6. Vòng sửa QA UX (11/11/2026 — docs/qa/FIX-ux.md)
     ======================================================================= */
  const D = document, ROOT = D.documentElement;

  /* ---- 6a. QU-27 / QU-33: tên cho nút chỉ có icon + nhãn trùng có ngữ cảnh ---- */
  const ICON_LABELS = {
    menu:"Mở menu", close:"Đóng", arrow_back:"Quay lại", arrow_forward:"Tiếp", chevron_left:"Trước", chevron_right:"Xem tiếp",
    add:"Thêm", add_circle:"Thêm", remove:"Bớt", remove_circle:"Bớt", search:"Tìm kiếm", refresh:"Làm mới", restart_alt:"Đặt lại",
    account_circle:"Hồ sơ", person:"Hồ sơ", tune:"Chỉnh mục tiêu", edit:"Sửa", drive_file_rename_outline:"Đổi tên",
    delete:"Xoá", delete_forever:"Xoá vĩnh viễn", share:"Chia sẻ", photo_camera:"Chụp ảnh", cameraswitch:"Đổi camera",
    more_vert:"Tuỳ chọn khác", more_horiz:"Tuỳ chọn khác", expand_more:"Mở rộng", expand_less:"Thu gọn",
    play_arrow:"Phát", play_circle:"Phát video", pause:"Tạm dừng", stop:"Dừng", check:"Xong", check_circle:"Xong", task_alt:"Xong",
    settings:"Cài đặt", notifications:"Thông báo", notifications_active:"Thông báo", filter_list:"Lọc", sort:"Sắp xếp",
    favorite:"Yêu thích", favorite_border:"Yêu thích", star:"Đánh giá", info:"Thông tin", help:"Trợ giúp", logout:"Đăng xuất",
    content_copy:"Sao chép", send:"Gửi", upload:"Tải lên", download:"Tải xuống", cloud_download:"Tải xuống", cloud_sync:"Đồng bộ",
    visibility:"Hiện", visibility_off:"Ẩn", history:"Lịch sử", event:"Lịch", edit_calendar:"Sửa lịch", schedule:"Giờ", timer:"Hẹn giờ",
    qr_code:"Mã QR", qr_code_scanner:"Quét mã QR", videocam:"Quay video", video_library:"Kho video", photo_library:"Thư viện ảnh",
    military_tech:"Thành tích", emoji_events:"Thành tích", arrow_upward:"Lên đầu trang", open_in_new:"Mở trong cửa sổ mới", link:"Liên kết",
    mail:"Gửi email", mail_outline:"Gửi email", call:"Gọi điện", location_on:"Vị trí", home:"Trang chủ", swap_horiz:"Đổi",
    bookmark:"Lưu", bookmark_border:"Lưu", shopping_cart:"Giỏ hàng", storefront:"Cửa hàng", palette:"Giao diện",
    dark_mode:"Chế độ tối", light_mode:"Chế độ sáng", fitness_center:"Bài tập", restaurant:"Dinh dưỡng", water_drop:"Nước uống",
    bedtime:"Giấc ngủ", insights:"Biểu đồ", show_chart:"Biểu đồ", bar_chart:"Biểu đồ", flag:"Báo cáo", report:"Báo cáo",
    block:"Chặn", playlist_add:"Thêm vào danh sách", rate_review:"Viết đánh giá", campaign:"Thông báo", key:"Mật khẩu",
    menu_book:"Kho kiến thức", library_books:"Thư viện bài tập", school:"Giáo án mẫu", groups:"PT", person_add:"Thêm học viên",
    person_remove:"Gỡ học viên", lightbulb:"Mẹo", tips_and_updates:"Mẹo", compare:"So sánh", aspect_ratio:"Đổi khung hình",
    visibility_lock:"Riêng tư", lock:"Khoá", lock_open:"Mở khoá", undo:"Hoàn tác", redo:"Làm lại", save:"Lưu", zoom_in:"Phóng to", zoom_out:"Thu nhỏ",
  };
  // nhãn quá chung → thêm ngữ cảnh (tên thẻ / mục) để không trùng: "Thêm – Bữa trưa"
  const GENERIC = /^(thêm|sửa|xoá|xóa|csv|yêu thích|xem|chọn|mở|tạo|lưu|chia sẻ|chi tiết|bỏ|huỷ|hủy|đặt lại|\+)$/i;
  function iconNameOf(el){
    const ic = el.querySelector(".material-symbols-rounded, [data-ic]");
    if(!ic) return "";
    return (ic.getAttribute("data-ic") || ic.textContent || "").trim();
  }
  function ownText(el){
    let t = "";
    el.childNodes.forEach(n=>{
      if(n.nodeType === 3) t += n.textContent;
      else if(n.nodeType === 1 && !n.classList.contains("material-symbols-rounded") && n.getAttribute("aria-hidden") !== "true" && n.tagName !== "SVG" && n.tagName !== "svg") t += " " + (n.textContent || "");
    });
    return t.replace(/\s+/g, " ").trim();
  }
  function hasName(el){
    return !!((el.getAttribute("aria-label") || "").trim() || el.getAttribute("aria-labelledby") || (el.getAttribute("title") || "").trim());
  }
  function contextOf(el){
    const box = el.closest(".card, .nu-meal, .list-item, .np-row, .exlib-row, article, li, [data-meal], .fk-ctx");
    if(!box) return "";
    const h = box.querySelector(".card-title, .nu-meal-h b, h3, h4, .name, b, strong");
    const t = h && h !== el && !el.contains(h) ? (h.textContent || "").replace(/\s+/g, " ").trim() : "";
    return t.length > 1 ? t.slice(0, 48) : "";
  }
  function labelOne(el){
    if(!el || el.nodeType !== 1 || el.dataset.fkAlSkip != null) return;
    const auto = el.dataset.fkAl === "1";
    if(hasName(el) && !auto) return;
    const text = ownText(el);
    if(text && !auto){
      // QU-33: nút chữ quá chung → nhãn có ngữ cảnh (vẫn chứa chữ hiển thị — WCAG 2.5.3)
      if(GENERIC.test(text)){ const c = contextOf(el); if(c){ el.setAttribute("aria-label", text + " – " + c); el.dataset.fkAl = "ctx"; } }
      return;
    }
    if(text && auto) return;
    const name = iconNameOf(el);
    let lb = ICON_LABELS[name] || "";
    if(!lb && name) lb = name.replace(/_/g, " ");
    if(!lb) return;
    if(lb === "Thêm" || lb === "Sửa" || lb === "Xoá"){ const c = contextOf(el); if(c) lb += " – " + c; }
    if(el.getAttribute("aria-label") !== lb) el.setAttribute("aria-label", lb);
    el.dataset.fkAl = "1";
  }
  const BTN_SEL = "button, [role='button'], a.icon-btn, .icon-btn";
  function labelButtons(root){
    if(!root || root.nodeType !== 1) return;
    if(root.matches && root.matches(BTN_SEL)) labelOne(root);
    const list = root.querySelectorAll ? root.querySelectorAll(BTN_SEL) : [];
    for(let i = 0; i < list.length; i++) labelOne(list[i]);
    // ảnh thiếu alt: ảnh minh hoạ cạnh chữ (thẻ/nút có tên) → alt="" (trang trí); còn lại → alt theo tên gần nhất
    const imgs = root.tagName === "IMG" ? [root] : (root.querySelectorAll ? root.querySelectorAll("img:not([alt])") : []);
    for(let i = 0; i < imgs.length; i++){
      const im = imgs[i]; if(im.hasAttribute("alt")) continue;
      const host = im.closest("button, a, [role='button'], .list-item, .card, li, figure");
      const t = host ? ownText(host) : "";
      im.setAttribute("alt", t ? "" : (contextOf(im) || ""));
    }
  }

  /* ---- 6b. QU-30 (lớp chung): div bấm được → role + tabindex + Enter/Space; toggle → switch ---- */
  const KBD_SEL = ".choice-card, .role-card, .metric, .streak-chip, .toggle, [data-edit-time]";
  function kbdOne(el){
    if(!el || el.nodeType !== 1 || /^(BUTTON|A|INPUT|SELECT|TEXTAREA|LABEL)$/.test(el.tagName)) return;
    if(el.closest("button, a[href]")) return;           // nằm trong nút thật → không lồng tương tác
    if(!el.hasAttribute("role")){
      const r = el.classList.contains("toggle") ? "switch" : el.classList.contains("choice-card") ? "radio" : "button";
      el.setAttribute("role", r);
    }
    if(!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    el.dataset.fkKbd = "1";
    syncChecked(el);
    if(el.classList.contains("choice-card") && el.parentElement && !el.parentElement.hasAttribute("role")) el.parentElement.setAttribute("role", "radiogroup");
  }
  function syncChecked(el){
    const r = el.getAttribute("role");
    if(r === "switch") el.setAttribute("aria-checked", String(el.classList.contains("on")));
    else if(r === "radio") el.setAttribute("aria-checked", String(el.classList.contains("selected") || el.classList.contains("active")));
  }
  function kbdScan(root){
    if(!root || root.nodeType !== 1) return;
    if(root.matches && root.matches(KBD_SEL)) kbdOne(root);
    const list = root.querySelectorAll ? root.querySelectorAll(KBD_SEL) : [];
    for(let i = 0; i < list.length; i++) kbdOne(list[i]);
  }
  D.addEventListener("keydown", (e)=>{
    if(e.defaultPrevented || (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar")) return;
    const el = e.target && e.target.closest && e.target.closest("[data-fk-kbd]");
    if(!el || el !== e.target) return;
    e.preventDefault(); el.click();
  });
  // sau mỗi cú chạm, đồng bộ aria-checked của switch/radio mà app đổi bằng class
  D.addEventListener("click", ()=>{ setTimeout(()=>{ try{ D.querySelectorAll("[data-fk-kbd][role='switch'], [data-fk-kbd][role='radio'], .choice-card[role='radio'], .toggle[role='switch']").forEach(syncChecked); }catch(e){} }, 0); }, true);

  /* ---- 6c. QU-35: h1 ẩn + tiêu đề trang theo màn, aria-current ở thanh dưới; QU-36: data-screen cho bố cục rộng ---- */
  const SCREEN_NAMES = { home:"Trang chủ", workout:"Tập luyện", nutrition:"Dinh dưỡng", coach:"PT", profile:"Hồ sơ", plans:"Giáo án",
    library:"Kho video", progress:"Tiến độ", exlib:"Thư viện bài tập", sleep:"Giấc ngủ", reminders:"Nhắc nhở", client:"Học viên",
    ptprofile:"Hồ sơ PT", community:"Cộng đồng", findpt:"Tìm PT", achieve:"Thành tích", events:"Sự kiện", kb:"Kho kiến thức", shop:"Cửa hàng" };
  function syncScreen(name){
    try{
      if(!name){ const a = D.querySelector(".screen.active"); name = a ? a.id.replace(/^screen-/, "") : "home"; }
      ROOT.setAttribute("data-screen", name);
      const label = SCREEN_NAMES[name] || (()=>{ const s = D.getElementById("screen-" + name); const l = s && s.querySelector(".topbar .logo, h1, h2"); return l ? (l.textContent || "").trim().slice(0, 40) : ""; })() || "TapEasy";
      const h = D.getElementById("fk-page-title"); if(h) h.textContent = "TapEasy — " + label;
      if(!/^TapEasy — Huấn luyện/.test(label)) D.title = label + " · TapEasy";
      D.querySelectorAll(".bottom-nav .nav-item").forEach(b=>{
        if(b.dataset.goto === name) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
      });
      if(typeof window.fkSyncScrolled === "function") window.fkSyncScrolled();   // đổi màn: vị trí cuộn mới
    }catch(e){}
  }

  /* ---- 6d. QU-10: ảnh chèn động → loading="lazy" decoding="async" (trừ ảnh hero / ưu tiên cao) ---- */
  function lazyImgs(root){
    if(!root || root.nodeType !== 1) return;
    const list = root.tagName === "IMG" ? [root] : (root.getElementsByTagName ? root.getElementsByTagName("img") : []);
    for(let i = 0; i < list.length; i++){
      const im = list[i];
      if(!im.hasAttribute("decoding")) im.setAttribute("decoding", "async");
      if(im.hasAttribute("loading") || im.getAttribute("fetchpriority") === "high" || im.closest(".hero, .wl-hero, .home-hero, .splash, .topbar")) continue;
      im.setAttribute("loading", "lazy");
    }
  }

  /* ---- 6e. QU-04 / QU-34: video nền màn chào ---- */
  function lowMedia(){
    try{
      const rm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      return !!(rm || saveDataOn() || fxActive());
    }catch(e){ return false; }
  }
  window.fkLowMedia = lowMedia;
  function stopVideo(v){
    try{ v.pause(); v.removeAttribute("src"); v.querySelectorAll("source").forEach(s=> s.remove()); v.load(); }catch(e){}
  }
  const SVG_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';
  const SVG_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  function wlVideo(v){
    if(!v || v.dataset.fkVid) return;
    v.dataset.fkVid = "1";
    if(lowMedia()){                        // giảm chuyển động / tiết kiệm dữ liệu / máy yếu → chỉ giữ ảnh nền tĩnh
      stopVideo(v); v.remove();
      const cr = D.querySelector(".wl-hero .wl-credit"); if(cr) cr.remove();
      return;
    }
    v.setAttribute("aria-hidden", "true"); v.setAttribute("tabindex", "-1");
    v.preload = "metadata";
    const hero = v.closest(".wl-hero") || v.parentNode; if(!hero || hero.querySelector(".fk-vid-toggle, .wl-vid-toggle")) return;   // 12/11: video.js đã có nút tạm dừng → không thêm nút thứ 2
    const btn = D.createElement("button");
    btn.type = "button"; btn.className = "fk-vid-toggle";
    const set = (playing)=>{ btn.innerHTML = playing ? SVG_PAUSE : SVG_PLAY;
      btn.setAttribute("aria-label", playing ? "Tạm dừng video nền" : "Phát video nền"); btn.setAttribute("aria-pressed", String(!playing)); };
    btn.addEventListener("click", ()=>{ if(v.paused){ v.play().catch(()=>{}); } else v.pause(); });
    v.addEventListener("play", ()=> set(true)); v.addEventListener("pause", ()=> set(false));
    set(!v.paused || v.autoplay);
    hero.appendChild(btn);
  }
  function wlSvg(svg){
    if(!svg || svg.dataset.fkSmil || typeof svg.pauseAnimations !== "function") return;
    svg.dataset.fkSmil = "1";
    try{ if(lowMedia()) svg.pauseAnimations(); else setTimeout(()=>{ try{ svg.pauseAnimations(); }catch(e){} }, 14000); }catch(e){}
  }
  function wlScan(root){
    if(!root || root.nodeType !== 1) return;
    const vids = root.matches && root.matches("video.wl-hero-video") ? [root] : root.querySelectorAll ? root.querySelectorAll("video.wl-hero-video") : [];
    for(let i = 0; i < vids.length; i++) wlVideo(vids[i]);
    const svgs = root.querySelectorAll ? root.querySelectorAll("svg.wl-routes") : [];
    for(let i = 0; i < svgs.length; i++) wlSvg(svgs[i]);
  }
  function wlLeave(){   // rời màn chào (vào app / sang đăng ký) → dừng hẳn video + SMIL
    const a = D.getElementById("auth");
    const onWelcome = a && a.classList.contains("open") && a.classList.contains("wl-mode");
    if(onWelcome) return;
    D.querySelectorAll("video.wl-hero-video").forEach(stopVideo);
    D.querySelectorAll("svg.wl-routes").forEach(s=>{ try{ s.pauseAnimations(); }catch(e){} });
  }
  // lần gọi sau (quay lại màn chào): không gọi API video khi máy cần tiết kiệm
  try{
    if(typeof mountWelcomeVideo === "function" && !mountWelcomeVideo.__fk){
      const _mwv = mountWelcomeVideo;
      mountWelcomeVideo = function(){ if(lowMedia()) return Promise.resolve(); return _mwv.apply(this, arguments); };
      mountWelcomeVideo.__fk = 1;
    }
  }catch(e){}

  /* ---- 6f. QU-08: JSZip nạp khi cần (sao lưu Google Drive) ---- */
  const JSZIP_CDN = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
  const JSZIP_SRI = "sha512-XMVd28F1oH/O71fzwBnV7HucLxVwtxf26XV8P4wPk26EDxuGZ91N8bsOttmnomcCD3CS5ZMRL50H0GgOHvegtg==";
  let jszipP = null;
  window.loadJSZip = function(){
    if(typeof window.JSZip !== "undefined") return Promise.resolve(window.JSZip);
    if(jszipP) return jszipP;
    const native = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
    const srcs = native ? ["vendor/jszip.min.js", JSZIP_CDN] : [JSZIP_CDN, "vendor/jszip.min.js"];
    jszipP = new Promise((resolve, reject)=>{
      let i = 0;
      const next = ()=>{
        if(i >= srcs.length){ jszipP = null; reject(new Error("Chưa tải được thư viện nén file — kiểm tra kết nối mạng rồi thử lại.")); return; }
        const src = srcs[i++], s = D.createElement("script");
        s.src = src; s.async = true;
        if(/^https:/.test(src)){ s.crossOrigin = "anonymous"; s.integrity = JSZIP_SRI; s.referrerPolicy = "no-referrer"; }
        s.onload = ()=> (typeof window.JSZip !== "undefined" ? resolve(window.JSZip) : next());
        s.onerror = ()=>{ s.remove(); next(); };
        (D.head || ROOT).appendChild(s);
      };
      next();
    });
    return jszipP;
  };
  function wrapZip(){
    ["buildBackupZip", "restoreFromBackupZip"].forEach(n=>{
      try{
        const f = window[n]; if(typeof f !== "function" || f.__fkZip) return;
        const w = async function(){ await window.loadJSZip(); return f.apply(this, arguments); };
        w.__fkZip = 1; window[n] = w;
      }catch(e){}
    });
  }
  wrapZip();

  /* ---- 6g. QU-26: dải "Đang ngoại tuyến" chung ---- */
  let offEl = null, offT = 0;
  function offlineBanner(on){
    try{
      if(!offEl){
        offEl = D.createElement("div"); offEl.className = "fk-offline"; offEl.id = "fk-offline";
        offEl.setAttribute("role", "status"); offEl.setAttribute("aria-live", "polite");
        (D.body || ROOT).appendChild(offEl);
      }
      clearTimeout(offT);
      if(on){
        offEl.classList.remove("back");
        offEl.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">wifi_off</span><span>Đang ngoại tuyến — dữ liệu vẫn lưu trên máy, sẽ đồng bộ khi có mạng.</span>`;
        offEl.classList.add("on");
      } else if(offEl.classList.contains("on")){
        offEl.classList.add("back");
        offEl.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">check_circle</span><span>Đã có mạng trở lại.</span>`;
        offT = setTimeout(()=> offEl && offEl.classList.remove("on", "back"), 2600);
      }
    }catch(e){}
  }
  window.fkOffline = offlineBanner;
  window.addEventListener("offline", ()=> offlineBanner(true));
  window.addEventListener("online", ()=> offlineBanner(false));

  /* ---- 6h. QU-05: đang cuộn → tạm bỏ blur ở thẻ trong danh sách (html.fk-scrolling; trừ khi người dùng chọn "Bật" kính mờ) ---- */
  let scrT = 0;
  D.addEventListener("scroll", e=>{
    if(!ROOT.classList.contains("fk-scrolling")) ROOT.classList.add("fk-scrolling");
    clearTimeout(scrT); scrT = setTimeout(()=> ROOT.classList.remove("fk-scrolling"), 160);
    if(e && e.target && e.target.id === "app-scroll") syncScrolled(e.target);
  }, { capture:true, passive:true });
  /* vòng 2 (ux · FIX-nutrition #4): đã cuộn khỏi đầu màn → html.fk-scrolled → thanh trên dính (.topbar) có nền
     (ui-kit.css) — tiêu đề "Dinh dưỡng" / nút ☰ không còn đè lên chữ của nội dung cuộn bên dưới */
  function syncScrolled(el){
    try{
      el = el || D.getElementById("app-scroll");
      const on = !!el && el.scrollTop > 6;
      if(on !== ROOT.classList.contains("fk-scrolled")) ROOT.classList.toggle("fk-scrolled", on);
    }catch(e){}
  }
  window.fkSyncScrolled = syncScrolled;

  /* =======================================================================
     7. R3 — PWA: báo có bản mới · mời cài đặt (Android/desktop + hướng dẫn iOS) · thông báo qua service worker
        (docs/qa/R3-ux.md R3-UX-02 / -05 / -06). App native (Capacitor) bỏ qua toàn bộ.
     ======================================================================= */
  const isNativeApp = ()=>{ try{ return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }catch(e){ return false; } };
  const isStandalone = ()=>{ try{ return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; }catch(e){ return false; } };
  const lsGet = k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } };
  const lsSet = (k, v)=>{ try{ localStorage.setItem(k, v); }catch(e){} };
  const tr = s=>{ try{ return window.FK_I18N ? window.FK_I18N.t(s) : s; }catch(e){ return s; } };

  /* 7a. R3-UX-02: service worker mới đã kích hoạt trong lúc app đang mở → dải "Có bản mới — Tải lại" (KHÔNG tự tải lại) */
  let updEl = null, updShown = false;
  function showUpdateBar(){
    if(updShown || isNativeApp()) return;
    updShown = true;
    try{
      updEl = D.createElement("div"); updEl.className = "fk-update"; updEl.id = "fk-update";
      updEl.setAttribute("role", "status"); updEl.setAttribute("aria-live", "polite");
      updEl.innerHTML = `<span class="fk-update-t">Có bản mới — tải lại để cập nhật</span><button type="button" class="fk-update-go">Tải lại</button><button type="button" class="fk-update-x" aria-label="Để sau">✕</button>`;
      updEl.querySelector(".fk-update-go").addEventListener("click", ()=>{ try{ location.reload(); }catch(e){} });
      updEl.querySelector(".fk-update-x").addEventListener("click", ()=>{ updEl.classList.remove("on"); setTimeout(()=>{ try{ updEl.remove(); }catch(e){} }, 300); });
      (D.body || ROOT).appendChild(updEl);
      requestAnimationFrame(()=> updEl.classList.add("on"));
    }catch(e){}
  }
  function watchServiceWorker(){
    try{
      const sw = navigator.serviceWorker;
      if(!sw || isNativeApp()) return;
      let hadController = !!sw.controller;                       // lần cài đầu tiên: controllerchange KHÔNG phải "bản mới"
      sw.addEventListener("controllerchange", ()=>{ if(hadController) showUpdateBar(); hadController = true; });
      sw.addEventListener("message", e=>{ const d = e && e.data; if(d && d.type === "FK_SW_ACTIVATED" && hadController) showUpdateBar(); });
      // quay lại app sau ≥ 30 phút → hỏi máy chủ có sw.js mới không (PWA mở nhiều ngày không tắt vẫn nhận bản mới)
      let last = Date.now();
      D.addEventListener("visibilitychange", ()=>{
        if(D.visibilityState !== "visible" || Date.now() - last < 30 * 60 * 1000) return;
        last = Date.now();
        try{ sw.getRegistration().then(r=>{ if(r && r.update) r.update().catch(()=>{}); }).catch(()=>{}); }catch(e){}
      });
    }catch(e){}
  }

  /* 7b. R3-UX-06: Android Chrome không cho `new Notification()` (ném TypeError) → nhắc nhở của app (app.js / pt.js) im lặng.
         Bọc hàm dựng: thử cách cũ, hỏng thì hiện qua registration.showNotification (sw.js có notificationclick). */
  function patchNotification(){
    try{
      const N = window.Notification;
      if(!N || N.__fkSw || isNativeApp() || !navigator.serviceWorker) return;
      const P = function(title, opts){
        try{ return new N(title, opts); }
        catch(err){
          const o = Object.assign({ icon:"assets/icon-192.png", badge:"assets/favicon-32.png" }, opts || {});
          if(o.icon === undefined) o.icon = "assets/icon-192.png";
          try{ navigator.serviceWorker.ready.then(r=> r.showNotification(String(title), o)).catch(()=>{}); }catch(e){}
          return { close(){}, addEventListener(){}, removeEventListener(){}, onclick:null };
        }
      };
      P.prototype = N.prototype; P.__fkSw = 1;
      P.requestPermission = function(){ return N.requestPermission.apply(N, arguments); };
      Object.defineProperty(P, "permission", { get(){ return N.permission; } });
      if("maxActions" in N) Object.defineProperty(P, "maxActions", { get(){ return N.maxActions; } });
      window.Notification = P;
    }catch(e){}
  }

  /* 7c. R3-UX-05: mời cài đặt. Android/desktop: beforeinstallprompt → nút "Cài"; iOS Safari: hướng dẫn "Thêm vào Màn hình chính".
         Hiện tối đa 1 lần / 14 ngày, không hiện ở màn chào / onboarding / đang có sheet, và chỉ từ lần mở thứ 2. */
  const INST_KEY = "fk_install_dismissed", VISIT_KEY = "fk_visits";
  let deferredPrompt = null, instEl = null;
  const isIOS = ()=>{ const ua = navigator.userAgent || ""; return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); };
  const isIOSSafari = ()=> isIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\/|Zalo/i.test(navigator.userAgent || "");
  function canOfferInstall(){ return !isNativeApp() && !isStandalone() && (!!deferredPrompt || isIOS()); }
  function installBusy(){
    try{
      const open = id=>{ const el = D.getElementById(id); return !!(el && el.classList && el.classList.contains("open")); };
      const ready = D.getElementById("ob-ready");
      return open("auth") || open("onboarding") || open("sheet-backdrop") || (ready && !ready.hidden) || !!D.querySelector(".ts-session.open, .fk-lang-dlg, .fk-update.on");
    }catch(e){ return true; }
  }
  function hideInstall(remember){
    if(remember) lsSet(INST_KEY, String(Date.now()));
    if(instEl){ const el = instEl; instEl = null; el.classList.remove("on"); setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 300); }
  }
  function showIOSGuide(){
    try{
      const html = `<div class="fk-ios-guide"><h3>Cài TapEasy lên iPhone</h3>
        <ol><li><span>Bấm nút Chia sẻ</span> <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3m0 0L8 7m4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg> <span>ở thanh dưới của Safari</span></li>
        <li>Chọn "Thêm vào Màn hình chính"</li><li>Bấm "Thêm" ở góc trên</li></ol>
        ${isIOSSafari() ? "" : `<p class="small-note">Trên iPhone, hãy mở trang này bằng Safari để cài đặt.</p>`}
        <button type="button" class="btn btn-primary btn-block" data-fk-close>Đã hiểu</button></div>`;
      if(typeof openSheet === "function"){
        openSheet(html);
        const sc = D.getElementById("sheet-content"), b = sc && sc.querySelector("[data-fk-close]");
        if(b) b.addEventListener("click", ()=>{ try{ closeSheet(); }catch(e){} });
      } else if(typeof toast === "function") toast('Safari → Chia sẻ → "Thêm vào Màn hình chính"');
    }catch(e){}
  }
  async function promptInstall(){
    if(deferredPrompt){
      const ev = deferredPrompt; deferredPrompt = null;
      try{ ev.prompt(); const r = await ev.userChoice; hideInstall(true); syncInstallRow(); return r && r.outcome; }catch(e){ return "error"; }
    }
    if(isIOS()){ hideInstall(true); showIOSGuide(); return "guide"; }
    return "unavailable";
  }
  function showInstallBar(){
    if(instEl || !canOfferInstall() || installBusy()) return;
    const last = +lsGet(INST_KEY) || 0;
    if(Date.now() - last < 14 * 86400e3) return;
    if((+lsGet(VISIT_KEY) || 0) < 2) return;
    try{
      instEl = D.createElement("div"); instEl.className = "fk-install"; instEl.id = "fk-install";
      instEl.setAttribute("role", "region"); instEl.setAttribute("aria-label", "Cài đặt ứng dụng");
      instEl.innerHTML = `<img src="assets/icon-192.png" alt="" width="40" height="40" data-no-fallback>
        <div class="fk-install-t"><b>Cài TapEasy</b><span>Thêm TapEasy vào màn hình chính để mở nhanh và dùng khi mất mạng.</span></div>
        <button type="button" class="fk-install-go">${deferredPrompt ? "Cài" : "Hướng dẫn"}</button>
        <button type="button" class="fk-install-x" aria-label="Để sau">✕</button>`;
      instEl.querySelector(".fk-install-go").addEventListener("click", promptInstall);
      instEl.querySelector(".fk-install-x").addEventListener("click", ()=> hideInstall(true));
      (D.body || ROOT).appendChild(instEl);
      requestAnimationFrame(()=> instEl && instEl.classList.add("on"));
    }catch(e){}
  }
  /* mục "Cài TapEasy" trong Hồ sơ (ngay trên thẻ tài khoản) — chỉ khi cài được */
  function syncInstallRow(){
    try{
      let row = D.getElementById("fk-install-row");
      if(!canOfferInstall()){ if(row) row.remove(); return; }
      if(row) return;
      const anchor = D.getElementById("profile-account-card");
      if(!anchor || !anchor.parentNode) return;
      row = D.createElement("div"); row.className = "card fk-lang-cardrow"; row.id = "fk-install-row";
      row.innerHTML = `<button type="button" class="list-item fk-lang-item" id="btn-install-app"><span class="thumb fk-lang-thumb" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14"/></svg></span>
        <span class="info"><span class="name">Cài TapEasy</span><span class="meta">Thêm TapEasy vào màn hình chính để mở nhanh và dùng khi mất mạng.</span></span><span class="trailing" aria-hidden="true">›</span></button>`;
      anchor.parentNode.insertBefore(row, anchor);
      row.querySelector("button").addEventListener("click", promptInstall);
    }catch(e){}
  }
  function initInstall(){
    if(isNativeApp()) return;
    try{
      if(!sessionStorage.getItem("fk_visit_counted")){ sessionStorage.setItem("fk_visit_counted", "1"); lsSet(VISIT_KEY, String((+lsGet(VISIT_KEY) || 0) + 1)); }
    }catch(e){}
    window.addEventListener("beforeinstallprompt", e=>{
      e.preventDefault(); deferredPrompt = e; syncInstallRow();
      setTimeout(showInstallBar, 8000);
    });
    window.addEventListener("appinstalled", ()=>{
      deferredPrompt = null; hideInstall(true); syncInstallRow();
      try{ if(typeof toast === "function") toast("Đã cài TapEasy — mở từ màn hình chính nhé!"); }catch(e){}
    });
    if(isIOS() && !isStandalone()) setTimeout(()=>{ syncInstallRow(); showInstallBar(); }, 12000);
  }
  window.fkInstall = { can: canOfferInstall, prompt: promptInstall, guide: showIOSGuide, standalone: isStandalone, _bar: showInstallBar, _update: showUpdateBar };

  /* ---- 6i. Quét chung (gọi được từ test: fkA11y.scan(el)) ---- */
  function scanAll(root){ labelButtons(root); kbdScan(root); lazyImgs(root); wlScan(root); }
  window.fkA11y = { scan: scanAll, label: labelOne, labels: ICON_LABELS, syncScreen, lowMedia, contextOf };
  function hookGoto(){
    try{
      if(typeof goto !== "function" || goto.__fkA11y) return;
      const _g = goto;
      goto = function(name){ const r = _g.apply(this, arguments); syncScreen(typeof name === "string" ? name : null); return r; };
      goto.__fkA11y = 1;
    }catch(e){}
  }

  /* ---------- khởi động ---------- */
  function init(){
    applyFx();
    try{ ROOT.classList.toggle("fk-lowmedia", lowMedia()); }catch(e){}
    hookGoto(); wrapZip();
    try{
      const body = D.body || ROOT;
      scanAll(body); syncScreen(null);
      const pending = new Set(); let qd = false;
      const flush = ()=>{ qd = false; pending.forEach(n=>{ if(n.isConnected) scanAll(n); }); pending.clear(); };
      new MutationObserver(muts=>{
        for(const m of muts){
          if(m.type === "childList"){
            for(const n of m.addedNodes) if(n.nodeType === 1) pending.add(n);
            for(const n of m.removedNodes) if(n.nodeType === 1 && n.querySelectorAll){
              if(n.matches && n.matches("video.wl-hero-video")) stopVideo(n);
              else n.querySelectorAll("video.wl-hero-video").forEach(stopVideo);
            }
            // icon đổi tên (vd. nút "+" → "Đổi tên") → cập nhật nhãn tự sinh
            const host = m.target && m.target.closest && m.target.closest("[data-fk-al='1']");
            if(host) pending.add(host);
          }
        }
        if(!qd && pending.size){ qd = true; Promise.resolve().then(flush); }
      }).observe(body, { childList:true, subtree:true });
      const auth = D.getElementById("auth");
      if(auth) new MutationObserver(wlLeave).observe(auth, { attributes:true, attributeFilter:["class"] });
    }catch(e){ console.warn("[ui-kit] a11y", e); }
    if(navigator.onLine === false) offlineBanner(true);
    watchServiceWorker(); patchNotification(); initInstall();          // R3: PWA
    try{
      const shell = document.getElementById("app-shell") || document.body;
      scanHints(shell);
      new MutationObserver(muts=>{
        for(const m of muts) for(const n of m.addedNodes) if(n.nodeType === 1) scanHints(n);
      }).observe(shell, { childList:true, subtree:true });
    }catch(e){ console.warn("[ui-kit] empty-hint", e); }
    scanBrokenImages();
    try{
      if(typeof finishBoot === "function"){
        const _fb = finishBoot;
        finishBoot = function(){ const r = _fb.apply(this, arguments); setTimeout(handleShortcut, 60); return r; };
      }
    }catch(e){}
    setTimeout(handleShortcut, 400);
    // cập nhật placeholder ảnh khi đổi theme
    window.addEventListener("fk:themechange", ()=>{
      document.querySelectorAll("img.fk-img-ph").forEach(img=>{ img.src = phSrc(phKind(img)); });
    });
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

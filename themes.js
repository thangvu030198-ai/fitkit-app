/* =========================================================================
   TapEasy — THEMES (themes.js)
   6 bảng màu + 5 GÓI GIAO DIỆN (theme pack = màu + chất liệu kính + font + bo góc + nền + chuyển động)
   + "Tự động" (theo cài đặt sáng/tối của máy).
   - Màu bảng cũ nằm ở themes.css; token của gói nằm ở theme-packs.css (+ hiệu ứng ở theme-packs.js).
   - Lưu: state.theme ("auto"|"navy"|"ocean"|"sunset"|"forest"|"midnight"|"light"|"aurora"|"espresso"|"alpine"|"wellness"|"sanctuary")
   - Áp dụng: <html data-theme data-theme-pref class="fk-themed fk-light|fk-dark [tp-pack]">,
     <meta name="theme-color">, thanh trạng thái Capacitor (nếu có plugin StatusBar), font Google của gói (nạp lười).
   - Bộ chọn giao diện: thẻ "Giao diện" trong màn Hồ sơ (ghi đè renderProfileScreen), gói có ảnh xem trước nhỏ.
   Nạp được ở 2 vị trí: trong <head> ngay sau themes.css (khuyên dùng — không nháy màu)
   hoặc sau pt.js. API: window.fkTheme.{list, pref(), current(), set(id), apply(), register(def), isLight(id)}
   ========================================================================= */
(function(){
  "use strict";
  const STORAGE_KEY = "fitkit_state_v1";
  const GF = "https://fonts.googleapis.com/css2?";
  /* mode: "dark" | "light" → class fk-dark / fk-light (theme sáng dùng mọi bản vá "nền sáng" của themes.css §4 và module).
     pack: true → gói giao diện (class tp-pack, ảnh xem trước pv, font nạp lười). */
  const THEMES = [
    { id:"auto",     name:"Tự động",   desc:"Theo sáng/tối của máy" },
    { id:"navy",     name:"Mặc định",  desc:"Navy · Teal · Coral",     meta:"#061A24", sw:["#061A24","#33D6C9","#FF7A45"] },
    { id:"ocean",    name:"Đại dương", desc:"Xanh biển · Cyan · Cát",  meta:"#03142B", sw:["#03142B","#4CC9F0","#FFB547"] },
    { id:"sunset",   name:"Hoàng hôn", desc:"Tím mận · Nắng · Hồng",   meta:"#1A0C1C", sw:["#1A0C1C","#FFC46B","#FF5C8A"] },
    { id:"forest",   name:"Rừng",      desc:"Rêu · Lá non · Quả mọng", meta:"#071A12", sw:["#071A12","#8BE07A","#FF6B6B"] },
    { id:"midnight", name:"Tím đêm",   desc:"Chàm · Oải hương · Ngọc", meta:"#0E0A26", sw:["#0E0A26","#B49CFF","#4FE3D6"] },
    { id:"light",    name:"Sáng",      desc:"Nền sáng, chữ đậm (AA)",  meta:"#EDF2F5", sw:["#F4F8FA","#0A7360","#B83D0B"], mode:"light" },
    /* ---- Gói giao diện (theme-packs.css / theme-packs.js) ---- */
    { id:"aurora",   name:"Aurora",         desc:"Đen tuyệt đối · tối giản · chữ trắng", meta:"#000000", pack:true,
      fonts:["Inter:wght@300;400;500;600;700"],
      pv:{ bg:"#000", card:"#1A1A1A", ink:"#fff", acc:"#C8F25A", cta:"#fff", ctaInk:"#000", r:"10px", font:"'Inter',sans-serif", w:600 } },
    { id:"espresso", name:"Espresso",       desc:"Nâu ấm · kính lỏng · ánh cam", meta:"#180A06", pack:true,
      fonts:["Inter:wght@400;500;600;700","Inter+Tight:wght@400;500;600"],
      pv:{ bg:"radial-gradient(80% 60% at 15% 0%, #8A4220, transparent 70%), radial-gradient(70% 50% at 100% 60%, #5E2A14, transparent 70%), #180A06",
           card:"rgba(255,236,220,.10)", ink:"#EDE4D8", acc:"#F2BC85", cta:"#FF8C4E", ctaInk:"#1A0A04", r:"12px", font:"'Inter Tight',sans-serif", w:500 } },
    { id:"alpine",   name:"Thu Alpine",     desc:"Sáng · kem & hổ phách · nhãn mono", meta:"#EAE6DE", pack:true, mode:"light",
      fonts:["Inter+Tight:wght@300;400;500;600","JetBrains+Mono:wght@500"],
      pv:{ bg:"radial-gradient(70% 50% at 100% 0%, #FBD06A, transparent 70%), #EAE6DE", card:"rgba(244,240,233,.96)", ink:"#2E2D2A",
           acc:"#7C6CF2", cta:"#F6B733", ctaInk:"#2E2D2A", r:"10px", font:"'Inter Tight',sans-serif", w:300 } },
    { id:"wellness", name:"Sương Wellness", desc:"Xanh xám sương · kính viền sáng", meta:"#34414D", pack:true,
      fonts:["Inter:wght@300;400;500;600;700","Inter+Tight:wght@400;500;600"],
      pv:{ bg:"radial-gradient(60% 40% at 25% 10%, rgba(255,255,255,.26), transparent 70%), linear-gradient(180deg,#4E5E70,#2E3741)",
           card:"rgba(255,255,255,.14)", ink:"#fff", acc:"#F6D873", cta:"#F6F3EC", ctaInk:"#26313C", r:"14px", font:"'Inter',sans-serif", w:400 } },
    { id:"sanctuary",name:"Sanctuary",      desc:"Nâu cà phê · kem · chữ mảnh editorial", meta:"#2A2322", pack:true,
      fonts:["Manrope:wght@300;400;500;600;700"],
      pv:{ bg:"linear-gradient(180deg,#5A4C41,#2A2322 55%,#1D191A)", card:"#F5F0E8", ink:"#F5F0E8", cardInk:"#1D191A",
           acc:"#F1E5C6", cta:"#F1E5C6", ctaInk:"#1D191A", r:"12px", font:"'Manrope',sans-serif", w:300 } },
  ];
  let IDS = THEMES.map(t=>t.id);
  const DEFAULT = "navy";
  const root = document.documentElement;
  const mqLight = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  /* ---------- đọc / phân giải ---------- */
  function rawPref(){
    try{
      if(typeof state !== "undefined" && state && typeof state === "object") return state.theme;
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) return JSON.parse(raw).theme;
    }catch(e){}
    return null;
  }
  function readPref(){ const t = rawPref(); return IDS.includes(t) ? t : DEFAULT; }
  function resolve(pref){
    if(pref === "auto") return mqLight && mqLight.matches ? "light" : "navy";
    return IDS.includes(pref) && pref !== "auto" ? pref : DEFAULT;
  }
  function byId(id){ return THEMES.find(t=>t.id===id) || THEMES[1]; }
  function isLight(id){ return byId(id).mode === "light"; }

  /* ---------- font Google của gói: nạp lười, chỉ khi gói được dùng ---------- */
  const fontLoaded = {};
  function ensureFonts(def){
    try{
      if(!def || !def.fonts || !def.fonts.length || window.TP_NO_REMOTE_FONTS) return;
      const fams = def.fonts.filter(f=> !fontLoaded[f]); if(!fams.length) return;
      fams.forEach(f=> fontLoaded[f] = 1);
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = GF + fams.map(f=> "family=" + f).join("&") + "&display=swap";
      l.setAttribute("data-tp-fonts", def.id);
      (document.head || root).appendChild(l);
    }catch(e){}
  }

  /* ---------- áp dụng ---------- */
  let current = null, currentPref = null;
  function apply(pref){
    pref = pref || readPref();
    const id = resolve(pref);
    const def = byId(id);
    currentPref = pref;
    root.setAttribute("data-theme", id);
    root.setAttribute("data-theme-pref", pref);
    // Bật lớp màu cho MỌI theme, kể cả Mặc định (vòng tích hợp 2 — docs/BRAND.md §9).
    root.classList.toggle("fk-themed", true);
    const light = isLight(id);
    root.classList.toggle("fk-light", light);
    root.classList.toggle("fk-dark", !light);
    root.classList.toggle("tp-pack", !!def.pack);
    if(def.pack) root.setAttribute("data-pack", id); else root.removeAttribute("data-pack");
    ensureFonts(def);
    const color = def.meta || "#061A24";
    setMetaColor(color);
    setStatusBar(light, color);
    if(current !== id){
      const prev = current; current = id;
      if(prev !== null){ try{ window.dispatchEvent(new CustomEvent("fk:themechange", { detail:{ id, pref, prev, pack:!!def.pack, light } })); }catch(e){} }
    }
    return id;
  }
  function setMetaColor(color){
    let m = document.querySelector('meta[name="theme-color"]');
    if(!m){ m = document.createElement("meta"); m.name = "theme-color"; (document.head || root).appendChild(m); }
    m.setAttribute("content", color);
  }
  function setStatusBar(isLightBg, color){
    try{
      const SB = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
      if(!SB) return;
      // Style "LIGHT" = chữ tối (dùng cho nền sáng); "DARK" = chữ sáng
      SB.setStyle({ style: isLightBg ? "LIGHT" : "DARK" }).catch(()=>{});
      if(SB.setBackgroundColor) SB.setBackgroundColor({ color }).catch(()=>{});
    }catch(e){}
  }

  /* ---------- đổi theme (lưu state) ---------- */
  function set(pref){
    if(!IDS.includes(pref)) return;
    try{
      if(typeof state !== "undefined" && state){ state.theme = pref; if(typeof saveState === "function") saveState(); }
      else{ const raw = localStorage.getItem(STORAGE_KEY); const s = raw ? JSON.parse(raw) : {}; s.theme = pref; localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
    }catch(e){}
    apply(pref);
    renderPicker();
    try{ if(typeof toast === "function") toast("Giao diện: " + byId(pref).name, "palette"); }catch(e){}
  }

  /* ---------- thêm gói mới lúc chạy (file gói nạp sau themes.js) ----------
     fkTheme.register({ id, name, desc, meta, mode?, pack:true, fonts?, pv:{bg,card,ink,acc,cta,ctaInk,r,font,w} }) */
  function register(def){
    try{
      if(!def || !/^[a-z][a-z0-9-]{1,23}$/.test(def.id || "") || IDS.includes(def.id)) return false;
      THEMES.push(Object.assign({ pack:true }, def)); IDS = THEMES.map(t=>t.id);
      if(rawPref() === def.id) apply(def.id);   // người dùng đã chọn gói này trước đó → áp ngay khi gói có mặt
      renderPicker();
      return true;
    }catch(e){ return false; }
  }

  /* Hệ điều hành đổi sáng/tối khi đang chọn "Tự động" */
  if(mqLight){
    const onChange = ()=>{ if(currentPref === "auto"){ apply("auto"); renderPicker(); } };
    if(mqLight.addEventListener) mqLight.addEventListener("change", onChange); else if(mqLight.addListener) mqLight.addListener(onChange);
  }

  /* ---------- icon mới (icons.js) ---------- */
  function addIcons(){
    try{
      if(typeof FK_LINE === "undefined") return;
      Object.assign(FK_LINE, {
        palette:"M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4.2 4H16a2 2 0 0 0-1.4 3.4A1.6 1.6 0 0 1 13.4 22z|c:7.5,10.5,1.2|c:10.5,6.8,1.2|c:15.2,7.4,1.2|c:17.3,11.3,1.2",
        dark_mode:"M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
        light_mode:"c:12,12,4|M12 2v2|M12 20v2|M4.9 4.9l1.4 1.4|M17.7 17.7l1.4 1.4|M2 12h2|M20 12h2|M4.9 19.1l1.4-1.4|M17.7 6.3l1.4-1.4",
        brightness_auto:"c:12,12,9|M12 3v18|M12 7.5h4.5|M12 12h6|M12 16.5h4.5",
        auto_awesome:"M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z|M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z",
        style:"r:3,3,8,8,2|r:13,3,8,8,2|r:3,13,8,8,2|c:17,17,4",
      });
    }catch(e){}
  }

  /* ---------- bộ chọn trong Hồ sơ ---------- */
  function esc(s){ return String(s).replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
  const cssv = v=> String(v == null ? "" : v).replace(/[;{}<>"]/g, "");   // giá trị biến CSS an toàn trong style=""
  function optHTML(t, pref){
    const on = t.id === pref;
    const check = `<span class="fk-theme-check" aria-hidden="true"><span class="material-symbols-rounded">check</span></span>`;
    if(t.pack && t.pv){
      const p = t.pv;
      const st = `--pv-bg:${cssv(p.bg)};--pv-card:${cssv(p.card)};--pv-ink:${cssv(p.ink)};--pv-card-ink:${cssv(p.cardInk || p.ink)};--pv-acc:${cssv(p.acc)};--pv-cta:${cssv(p.cta)};--pv-cta-ink:${cssv(p.ctaInk)};--pv-r:${cssv(p.r || "10px")};--pv-font:${cssv(p.font || "inherit")};--pv-w:${cssv(p.w || 600)}`;
      return `<button type="button" class="fk-theme-opt fk-pack-opt" role="radio" aria-checked="${on}" data-fk-theme="${t.id}" style="${st}">
        <span class="fk-pack-pv" aria-hidden="true"><em>Aa</em><i class="l1"></i><i class="l2"></i><span class="c"><i class="g"></i><i class="b1"></i><i class="b2"></i></span><i class="cta"></i></span>
        <span class="fk-theme-txt"><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></span>${check}
      </button>`;
    }
    const sw = t.sw ? `style="--sw-bg:${t.sw[0]};--sw-a:${t.sw[1]};--sw-b:${t.sw[2]}"` : "";
    const desc = t.id === "auto" ? `${t.desc} · đang ${byId(resolve("auto")).name.toLowerCase()}` : t.desc;
    return `<button type="button" class="fk-theme-opt" role="radio" aria-checked="${on}" data-fk-theme="${t.id}" ${sw}>
        <span class="fk-theme-sw ${t.id==="auto"?"auto":""}" aria-hidden="true">${t.sw ? "<i></i><i></i>" : ""}</span>
        <span class="fk-theme-txt"><b>${esc(t.name)}</b><small>${esc(desc)}</small></span>${check}
      </button>`;
  }
  function pickerHTML(){
    const pref = currentPref || readPref();
    const classic = THEMES.filter(t=> !t.pack).map(t=> optHTML(t, pref)).join("");
    const packs = THEMES.filter(t=> t.pack).map(t=> optHTML(t, pref)).join("");
    let fx = "";
    if(window.fkFx){
      const m = window.fkFx.mode();
      const b = (v, l)=> `<button type="button" role="radio" aria-checked="${m===v}" data-fk-fx="${v}">${l}</button>`;
      fx = `<div class="fk-fx-row">
        <div class="t"><b>Hiệu ứng kính mờ</b><small>${window.fkFx.active() ? "Đang giảm để máy mượt hơn" : "Đang bật đầy đủ"}</small></div>
        <div class="fk-seg" role="radiogroup" aria-label="Hiệu ứng kính mờ">${b("auto","Tự động")}${b("full","Bật")}${b("low","Giảm")}</div>
      </div>`;
    }
    return `<div class="card-title"><span class="material-symbols-rounded">palette</span>Giao diện</div>
      <div role="radiogroup" aria-label="Chọn giao diện">
        <div class="fk-theme-grid">${classic}</div>
        ${packs ? `<div class="fk-pack-h"><span class="material-symbols-rounded" aria-hidden="true">style</span>Gói giao diện <small>màu · chất liệu · font · chuyển động</small></div>
        <div class="fk-theme-grid fk-pack-grid">${packs}</div>` : ""}
      </div>
      ${fx}`;
  }
  function renderPicker(){
    try{
      const scr = document.getElementById("screen-profile"); if(!scr) return;
      const content = scr.querySelector(".content"); if(!content) return;
      let card = document.getElementById("fk-theme-card");
      if(!card){
        card = document.createElement("div");
        card.className = "card fk-theme-card"; card.id = "fk-theme-card";
        const anchor = document.getElementById("profile-account-card");
        if(anchor && anchor.parentNode === content) content.insertBefore(card, anchor); else content.appendChild(card);
        card.addEventListener("click", (e)=>{
          const t = e.target.closest("[data-fk-theme]"); if(t){ set(t.dataset.fkTheme); return; }
          const f = e.target.closest("[data-fk-fx]"); if(f && window.fkFx){ window.fkFx.set(f.dataset.fkFx); renderPicker(); }
        });
        card.addEventListener("keydown", (e)=>{
          if(!["ArrowRight","ArrowDown","ArrowLeft","ArrowUp"].includes(e.key)) return;
          const btn = e.target.closest("[data-fk-theme]"); if(!btn) return;
          const list = Array.from(card.querySelectorAll("[data-fk-theme]"));
          const i = list.indexOf(btn), d = (e.key==="ArrowRight"||e.key==="ArrowDown") ? 1 : -1;
          const nx = list[(i + d + list.length) % list.length]; e.preventDefault(); nx.focus();
        });
      }
      const had = document.activeElement && card.contains(document.activeElement) ? document.activeElement.getAttribute("data-fk-theme") : null;
      card.innerHTML = pickerHTML();
      if(had){ const b = card.querySelector(`[data-fk-theme="${had}"]`); if(b) b.focus({ preventScroll:true }); }
    }catch(e){ console.warn("[themes] picker", e); }
  }

  /* ---------- tích hợp với app ---------- */
  let hooked = false;
  function hookApp(){
    if(hooked || typeof renderProfileScreen !== "function") return;
    hooked = true;
    addIcons();
    const _old = renderProfileScreen;
    renderProfileScreen = function(){
      const r = _old.apply(this, arguments);
      try{ apply(readPref()); renderPicker(); }catch(e){}
      return r;
    };
    apply(readPref());
    renderPicker();
  }

  window.fkTheme = { list:THEMES, pref:()=> currentPref || readPref(), current:()=> current || resolve(readPref()),
    set, apply, resolve, renderPicker, register, isLight, byId };

  try{ apply(readPref()); }catch(e){}
  /* QU-05 / QU-04 (vòng sửa UX): bật sớm html.lowfx / html.fk-lowmedia ngay trong <head> — trước lần vẽ đầu,
     tránh vẽ kính mờ rồi mới gỡ. Cùng quy tắc với ui-kit.js (fkFx): RAM ≤ 4 GB, ≤ 4 lõi, Save-Data/2g,
     giảm trong suốt; iPhone/iPad không tính số lõi. Người dùng chọn "Bật"/"Giảm" (state.fxMode) thì theo lựa chọn. */
  try{
    let mode = "auto";
    try{ const raw = localStorage.getItem(STORAGE_KEY); const m = raw && JSON.parse(raw).fxMode; if(["auto","full","low"].includes(m)) mode = m; }catch(e){}
    const nav = navigator, conn = nav.connection || {};
    const saveData = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "");
    const mq = q=> !!(window.matchMedia && window.matchMedia(q).matches);
    const apple = /iPhone|iPad|iPod/.test(nav.userAgent || "") || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
    const weak = mq("(prefers-reduced-transparency: reduce)") || saveData || (!apple && ((nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4));
    const low = mode === "low" || (mode === "auto" && weak);
    root.classList.toggle("lowfx", low);
    root.classList.toggle("fk-fx-full", mode === "full");
    root.classList.toggle("fk-lowmedia", low || saveData || mq("(prefers-reduced-motion: reduce)"));
  }catch(e){}
  if(typeof renderProfileScreen === "function") hookApp();
  else document.addEventListener("DOMContentLoaded", ()=>{ try{ hookApp(); }catch(e){} });
})();

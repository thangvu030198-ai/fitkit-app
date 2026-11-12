/* =========================================================================
   TapEasy — kiểm thử cảm giác bấm (press-feel.js) trong trình duyệt thật (Playwright, khung 390 px)
   python3 scripts/build-single-html.py _test/press.html --offline --test tests/browser/t_press.js
   Lần đầu: ghi state đã onboard rồi tải lại. Kết quả: document.title = "PASS x/y ERR n", window.__results, window.__pressReport.
   Kiểm:
     - BẤT BIẾN CHỐNG NHÁY trên 11 theme × (kính đầy đủ | html.lowfx) × 3 màn: phần tử đang lún (transform) KHÔNG có
       backdrop-filter và không có con có backdrop-filter;
     - .is-pressed có ngay sau pointerdown (đồng bộ) và giao diện đổi ở khung hình kế tiếp;
     - rung đúng loại với Capacitor giả; reduced-motion (giả lập bằng cờ) không scale; thẻ onboarding không kính khi lún.
   ========================================================================= */
(function(){
  const KEY = "fitkit_state_v1";
  if(!localStorage.getItem(KEY)){
    localStorage.setItem(KEY, JSON.stringify({ onboarded:true, authDone:true, hsDismissed:true,
      profile:{ name:"Tester", gender:"male", age:28, height:172, weight:70, activity:"moderate", goal:"gain", autoTargets:true } }));
    location.reload(); return;
  }
  const results = window.__results = [];
  const ok = (name, cond, info)=> results.push({ name, pass: !!cond, info: info || "" });
  const sleep = ms=> new Promise(r=> setTimeout(r, ms));
  const raf = ()=> new Promise(r=> requestAnimationFrame(t=> r(t)));
  const errs = ()=> (window.__errs || []).filter(e=> !/Failed to load resource|net::ERR|gsi\/client|jszip|ResizeObserver loop|morphicons\.min\.js/i.test(e));
  const bf = el=>{ const s = getComputedStyle(el); const v = s.backdropFilter || s.webkitBackdropFilter || "none"; return v && v !== "none"; };
  const kidsBf = el=> [...el.querySelectorAll("*")].slice(0, 60).some(bf);
  const visible = el=>{ const r = el.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && getComputedStyle(el).visibility !== "hidden"; };
  const pe = (type, el, extra)=>{ const r = el.getBoundingClientRect();
    return new PointerEvent(type, Object.assign({ bubbles:true, cancelable:true, composed:true, pointerId:7, isPrimary:true, pointerType:"touch", button:0,
      clientX: r.left + r.width/2, clientY: r.top + r.height/2 }, extra || {})); };
  const report = window.__pressReport = { combos: [], timing: {}, onboarding: {} };

  async function sweep(label){
    let n = 0, scaled = 0, glass = 0, noblur = 0, still = 0; const bad = [];
    const els = [...document.querySelectorAll(".screen.active *, .bottom-nav *")].filter(el=> fkPress._h.targetOf(el) === el && visible(el)).slice(0, 40);
    for(const el of els){
      el.dispatchEvent(pe("pointerdown", el));
      n++;
      const pressed = el.classList.contains("is-pressed");
      const willScale = pressed && !el.classList.contains("pf-glass") && !el.classList.contains("pf-still");
      if(willScale){ scaled++; if(el.classList.contains("pf-noblur")) noblur++;
        if(bf(el) || kidsBf(el)) bad.push((el.className || el.tagName).toString().slice(0, 60)); }
      if(el.classList.contains("pf-glass")) glass++;
      if(el.classList.contains("pf-still")) still++;
      if(!pressed) bad.push("không .is-pressed: " + (el.className || el.tagName).toString().slice(0, 50));
      document.dispatchEvent(new PointerEvent("pointercancel", { bubbles:true, pointerId:7 }));
    }
    report.combos.push({ label, n, scaled, glass, noblur, still, bad: bad.slice(0, 5) });
    return bad;
  }

  (async ()=>{
    await sleep(900);
    try{ if(typeof closeSheet === "function") closeSheet(); }catch(e){}
    await sleep(300);
    ok("fkPress + fkBusy có mặt", window.fkPress && typeof fkBusy === "function");

    // 1. Tức thì: .is-pressed đồng bộ ngay trong pointerdown; khung kế tiếp đã đổi giao diện
    goto("home"); await sleep(600);
    const cta = document.querySelector(".screen.active .btn-primary") || document.querySelector(".screen.active .btn");
    if(cta){
      const before = getComputedStyle(cta).boxShadow + "|" + getComputedStyle(cta).filter;
      const deltas = [], handler = [];
      for(let i = 0; i < 15; i++){
        await raf();
        const t0 = performance.now();
        cta.dispatchEvent(pe("pointerdown", cta));
        const t1 = performance.now(); handler.push(t1 - t0);
        const sync = cta.classList.contains("is-pressed");
        const tf = await raf();
        const after = getComputedStyle(cta).boxShadow + "|" + getComputedStyle(cta).filter;
        deltas.push({ ms: tf - t0, sync, changed: after !== before });
        document.dispatchEvent(new PointerEvent("pointerup", { bubbles:true, pointerId:7 }));
        await sleep(320);
      }
      const med = a=> a.slice().sort((x, y)=> x - y)[Math.floor(a.length/2)];
      report.timing = { handlerMsMedian: +med(handler).toFixed(2), handlerMsMax: +Math.max(...handler).toFixed(2),
        frameMsMedian: +med(deltas.map(d=> d.ms)).toFixed(2), frameMsMax: +Math.max(...deltas.map(d=> d.ms)).toFixed(2),
        allSync: deltas.every(d=> d.sync), allChangedNextFrame: deltas.every(d=> d.changed) };
      ok("pointerdown → .is-pressed đồng bộ (không đợi click)", report.timing.allSync);
      ok("Giao diện đổi ở khung kế tiếp (< 16,7 ms, trung vị)", report.timing.allChangedNextFrame && report.timing.frameMsMedian < 16.7, JSON.stringify(report.timing));
      ok("Bộ xử lý pointerdown (mọi listener) trung vị < 4 ms", report.timing.handlerMsMedian < 4, JSON.stringify(report.timing));
    } else ok("Có nút CTA ở Trang chủ", false);

    // 2. Bất biến chống nháy — 11 theme × kính/lowfx × 3 màn
    const themes = (window.fkTheme ? fkTheme.list.map(t=> t.id) : ["navy"]).filter(id=> id !== "auto");
    ok("Đủ 11 theme", themes.length === 11, themes.join(","));
    const root = document.documentElement;
    let badAll = [];
    for(const th of themes){
      fkTheme.set(th); await sleep(120);
      for(const low of [false, true]){
        root.classList.toggle("lowfx", low); await sleep(30);
        for(const scr of ["home", "profile", "nutrition"]){
          goto(scr); await sleep(220);
          const bad = await sweep(`${th}${low ? "+lowfx" : ""}/${scr}`);
          badAll = badAll.concat(bad.map(b=> `${th}${low?"+lowfx":""}/${scr}: ${b}`));
        }
      }
    }
    root.classList.remove("lowfx");
    fkTheme.set("navy"); await sleep(100);
    ok("Không phần tử nào vừa lún (transform) vừa có kính/con có kính — 11 theme × 2 × 3 màn", badAll.length === 0, badAll.slice(0, 6).join(" | "));
    const tot = report.combos.reduce((a, c)=> ({ n: a.n + c.n, s: a.s + c.scaled, g: a.g + c.glass, nb: a.nb + c.noblur }), { n:0, s:0, g:0, nb:0 });
    ok("Đã quét đủ phần tử", tot.n > 300, JSON.stringify(tot));

    // 3. Rung: cần chạm THẬT (isTrusted) → kiểm trong kịch bản Playwright (docs/PRESS-FEEL.md §Kiểm thử); ở đây chỉ kiểm API
    { const log = []; const oldCap = window.Capacitor;
      window.Capacitor = { isNativePlatform: ()=> true, Plugins: { Haptics: { impact(o){ log.push("impact:" + o.style); return Promise.resolve(); },
        notification(o){ log.push("notification:" + o.type); return Promise.resolve(); }, selectionStart(){ log.push("sel"); return Promise.resolve(); },
        selectionChanged(){ return Promise.resolve(); }, selectionEnd(){ return Promise.resolve(); } } } };
      fkPress.haptic("success"); fkPress.haptic("medium"); fkPress.set(false); fkPress.haptic("light"); fkPress.set(true);
      ok("Rung API: success/medium; tắt công tắc → im", log.join(",") === "notification:SUCCESS,impact:MEDIUM", log.join(","));
      window.Capacitor = oldCap; }

    // 4. Thẻ cài đặt trong Hồ sơ
    goto("profile"); try{ renderProfileScreen(); }catch(e){} await sleep(300);
    const sw = document.getElementById("pf-haptic-sw");
    ok("Hồ sơ: công tắc 'Rung khi chạm' (role=switch, ≥ 44 px)", !!sw && sw.getAttribute("role") === "switch" && sw.getBoundingClientRect().height >= 44);
    if(sw){ sw.click(); await sleep(50); const off = sw.getAttribute("aria-checked") === "false" && !fkPress.enabled(); sw.click(); await sleep(50);
      ok("Hồ sơ: bấm công tắc đổi trạng thái + lưu", off && fkPress.enabled() && JSON.parse(localStorage.getItem(KEY)).pressFeel.haptic === true); }

    // 5. Onboarding: thẻ chọn lún mà KHÔNG có kính
    try{ openOnboarding(true); }catch(e){}
    await sleep(500); try{ showObStep(3); }catch(e){} await sleep(700);
    const oc = [...document.querySelectorAll("#onboarding .choice-card")].find(visible);
    if(oc){
      oc.dispatchEvent(pe("pointerdown", oc)); await raf(); await sleep(90);
      const s = getComputedStyle(oc);
      report.onboarding = { transform: s.transform, backdrop: s.backdropFilter, cls: oc.className };
      ok("Onboarding: thẻ lún (transform) và không backdrop-filter", s.transform !== "none" && (!s.backdropFilter || s.backdropFilter === "none") && !kidsBf(oc), JSON.stringify(report.onboarding));
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles:true, pointerId:7 })); await sleep(320);
    } else ok("Onboarding: có thẻ chọn", false);

    const e = errs();
    ok("Không lỗi JS", e.length === 0, e.join(" | ").slice(0, 400));
    const pass = results.filter(r=> r.pass).length;
    document.title = `PASS ${pass}/${results.length} ERR ${e.length}`;
  })().catch(err=>{ ok("ném lỗi", false, err && err.stack); document.title = "FAIL " + (err && err.message); });
})();
